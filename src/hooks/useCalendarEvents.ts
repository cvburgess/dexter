import { Temporal } from "@js-temporal/polyfill";
import { useQuery } from "@tanstack/react-query";
import * as Calendar from "expo-calendar";
// SDK 57's OO `event.getAttendees()` returns empty shared objects on iOS;
// the `/legacy` import also dodges the main module's deprecation throw.
import { getAttendeesForEventAsync } from "expo-calendar/legacy";

import { useAuth } from "./useAuth";
import { useEnabledDeviceCalendars } from "./useEnabledDeviceCalendars";
import { usePreferences } from "./usePreferences";
import {
  TCalendarEvent,
  TEventResponse,
  TUseCalendarEvents,
} from "./useCalendarEvents.types";

// Native calendar source; `tsc` resolves this base file, while Metro picks
// `useCalendarEvents.web.ts` (proxied .ics feeds) on web.

const STALE_TIME_MS = 1000 * 60 * 10;

type TDeviceResult = {
  events: TCalendarEvent[];
  permissionDenied: boolean;
  notConfigured: boolean;
};

// Minimal structural shapes for the expo-calendar objects we read — decoupled
// from the library's exact exported type names (which shift between SDKs).
type TDeviceEvent = {
  id: string;
  title?: string;
  startDate: string | Date;
  endDate: string | Date;
  allDay?: boolean;
  calendarId: string;
};

// The attendee fields we read. `isCurrentUser` is iOS-only; `email` backs the
// match on Android, where the OS doesn't flag the current user.
type TDeviceAttendee = {
  isCurrentUser?: boolean;
  email?: string;
  status?: Calendar.AttendeeStatus;
};

/**
 * RSVP → app response. Declined/unknown fall to `undefined` (normal styling);
 * only invited and tentative are visually distinguished.
 */
const statusToResponse = (
  status: Calendar.AttendeeStatus | undefined,
): TEventResponse | undefined => {
  switch (status) {
    case Calendar.AttendeeStatus.ACCEPTED:
      return "accepted";
    case Calendar.AttendeeStatus.TENTATIVE:
      return "tentative";
    case Calendar.AttendeeStatus.PENDING:
    case Calendar.AttendeeStatus.INVITED:
      return "invited";
    default:
      return undefined;
  }
};

/**
 * Prefers the OS `isCurrentUser` flag (iOS); Android matches signed-in email.
 * A failed lookup yields `undefined` so the event still renders.
 */
const fetchEventResponse = async (
  eventId: string,
  userEmail: string | undefined,
): Promise<TEventResponse | undefined> => {
  try {
    const attendees = (await getAttendeesForEventAsync(
      eventId,
    )) as TDeviceAttendee[];
    const target = userEmail?.toLowerCase();
    const me =
      attendees.find((a) => a.isCurrentUser) ??
      (target
        ? attendees.find((a) => a.email?.toLowerCase() === target)
        : undefined);
    return statusToResponse(me?.status);
  } catch {
    return undefined;
  }
};

/** Absolute instant (from a native ISO string or Date) → local wall-clock. */
const toPlainDateTime = (
  value: string | Date,
  timeZone: string,
): Temporal.PlainDateTime => {
  const ms =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Temporal.Instant.fromEpochMilliseconds(ms)
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime();
};

const nativeToEvent = (
  event: TDeviceEvent,
  timeZone: string,
  colorById: Map<string, string | undefined>,
  response: TEventResponse | undefined,
): TCalendarEvent => {
  const startMs =
    event.startDate instanceof Date
      ? event.startDate.getTime()
      : new Date(event.startDate).getTime();
  return {
    // expo-calendar reuses one `id` across a recurring event's occurrences;
    // suffix the start to keep React keys unique (mirrors the web id).
    id: `${event.id}-${startMs}`,
    title: event.title || "(No title)",
    start: toPlainDateTime(event.startDate, timeZone),
    end: toPlainDateTime(event.endDate, timeZone),
    allDay: Boolean(event.allDay),
    color: colorById.get(event.calendarId),
    response,
  };
};

/**
 * `enabledIds === null` means never customized → all calendars. `notConfigured`
 * falls out of the early returns to avoid a second call/permission prompt.
 */
const fetchDeviceEvents = async (
  dateIso: string,
  enabledIds: string[] | null,
  userEmail: string | undefined,
): Promise<TDeviceResult> => {
  const { granted } = await Calendar.requestCalendarPermissions();
  if (!granted) {
    return { events: [], permissionDenied: true, notConfigured: true };
  }

  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const allIds = calendars.map((c) => c.id);
  const ids = (enabledIds ?? allIds).filter((id) => allIds.includes(id));
  if (ids.length === 0) {
    return { events: [], permissionDenied: false, notConfigured: true };
  }

  const colorById = new Map<string, string | undefined>(
    calendars.map((c) => [c.id, c.color] as [string, string | undefined]),
  );
  const timeZone = Temporal.Now.timeZoneId();
  const date = Temporal.PlainDate.from(dateIso);
  const dayStart = new Date(
    date.toZonedDateTime(timeZone).toInstant().epochMilliseconds,
  );
  const dayEnd = new Date(
    date.add({ days: 1 }).toZonedDateTime(timeZone).toInstant()
      .epochMilliseconds,
  );

  const native = await Calendar.listEvents(ids, dayStart, dayEnd);
  // Attendee status is a separate lookup per event; resolve them concurrently.
  const events = await Promise.all(
    native.map(async (event) => {
      const response = await fetchEventResponse(event.id, userEmail);
      return nativeToEvent(event, timeZone, colorById, response);
    }),
  );
  return { events, permissionDenied: false, notConfigured: false };
};

/**
 * Native calendar source: events from the device's enabled calendars for the
 * viewed day.
 */
export const useCalendarEvents = (
  date: Temporal.PlainDate,
): TUseCalendarEvents => {
  const [preferences] = usePreferences();
  const { session } = useAuth();
  const userEmail = session?.user?.email;
  const [enabledIds, { isLoading: enabledLoading }] =
    useEnabledDeviceCalendars();
  const active = preferences.enableCalendar;

  const { data, isLoading, isError } = useQuery({
    // Waiting on the selection keeps a cold start from briefly fetching (and
    // caching) every calendar under a stale `null` key.
    enabled: active && !enabledLoading,
    queryKey: ["calendarEvents", date.toString(), enabledIds, userEmail],
    queryFn: () => fetchDeviceEvents(date.toString(), enabledIds, userEmail),
    staleTime: STALE_TIME_MS,
    // Refetch per day-load to pick up calendar edits; cached events still show
    // during the background refetch, so there's no empty flash.
    refetchOnMount: "always",
  });

  // `notConfigured: false` here keeps a still-loading read from reading as an
  // unconfigured one — the answer isn't known until the query resolves.
  const result = data ?? {
    events: [],
    permissionDenied: false,
    notConfigured: false,
  };
  return [
    result.events,
    {
      isLoading: active && (enabledLoading || isLoading),
      isError,
      permissionDenied: result.permissionDenied,
      notConfigured: result.notConfigured,
    },
  ];
};
