import { Temporal } from "@js-temporal/polyfill";
import { useQuery } from "@tanstack/react-query";
import * as Calendar from "expo-calendar";
// Attendee RSVP comes from the legacy by-id call: the new OO API's
// `event.getAttendees()` returns empty shared objects on iOS in SDK 57
// (status/isCurrentUser never populate). Imported from `/legacy` so it doesn't
// hit the deprecation guard that throws when the same method is used off the
// main module.
import { getAttendeesForEventAsync } from "expo-calendar/legacy";

import { useAuth } from "./useAuth";
import { useEnabledDeviceCalendars } from "./useEnabledDeviceCalendars";
import { usePreferences } from "./usePreferences";
import {
  TCalendarEvent,
  TEventResponse,
  TUseCalendarEvents,
} from "./useCalendarEvents.types";

// Native (iOS + Android) calendar source: the device's own calendars via
// expo-calendar. This base file is also what `tsc` resolves; Metro picks
// `useCalendarEvents.web.ts` on web (proxied .ics feeds instead).

const STALE_TIME_MS = 1000 * 60 * 10;

type TDeviceResult = {
  events: TCalendarEvent[];
  permissionDenied: boolean;
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
 * The current user's RSVP → app response. Only the not-a-firm-yes states get a
 * distinct value; accepted/declined/unknown fall through to `undefined` (normal
 * styling), since we only visually distinguish invited and tentative.
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
 * Resolve the current user's RSVP for an event via its attendee list. Prefers
 * the OS `isCurrentUser` flag (iOS); otherwise matches the signed-in email. A
 * failed lookup or no match yields `undefined` so the event still renders.
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
): TCalendarEvent => ({
  id: event.id,
  title: event.title || "(No title)",
  start: toPlainDateTime(event.startDate, timeZone),
  end: toPlainDateTime(event.endDate, timeZone),
  allDay: Boolean(event.allDay),
  color: colorById.get(event.calendarId),
  response,
});

/**
 * Read the day's events from the enabled device calendars. Requests permission
 * on first use; a denied grant returns no events with `permissionDenied` set so
 * the UI can prompt. `enabledIds === null` means the user hasn't customized the
 * selection yet, so every calendar is included.
 */
const fetchDeviceEvents = async (
  dateIso: string,
  enabledIds: string[] | null,
  userEmail: string | undefined,
): Promise<TDeviceResult> => {
  const { granted } = await Calendar.requestCalendarPermissions();
  if (!granted) {
    return { events: [], permissionDenied: true };
  }

  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const allIds = calendars.map((c) => c.id);
  const ids = (enabledIds ?? allIds).filter((id) => allIds.includes(id));
  if (ids.length === 0) return { events: [], permissionDenied: false };

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
  return { events, permissionDenied: false };
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
    // Wait for the device-local selection to load before fetching, so a cold
    // start with some calendars disabled doesn't briefly fetch (and cache)
    // every calendar under a stale `null` key.
    enabled: active && !enabledLoading,
    queryKey: ["calendarEvents", date.toString(), enabledIds, userEmail],
    queryFn: () => fetchDeviceEvents(date.toString(), enabledIds, userEmail),
    staleTime: STALE_TIME_MS,
    // SwipeableDay mounts a fresh view per day, so refetch on every day-load to
    // pick up calendar edits made since the day was last cached. Cached events
    // still show during the background refetch, so there's no empty flash.
    refetchOnMount: "always",
  });

  const result = data ?? { events: [], permissionDenied: false };
  return [
    result.events,
    {
      isLoading: active && (enabledLoading || isLoading),
      isError,
      permissionDenied: result.permissionDenied,
    },
  ];
};
