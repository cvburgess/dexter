import { Temporal } from "@js-temporal/polyfill";
import { useQuery } from "@tanstack/react-query";
import * as Calendar from "expo-calendar";

import { useEnabledDeviceCalendars } from "./useEnabledDeviceCalendars";
import { usePreferences } from "./usePreferences";
import { TCalendarEvent, TUseCalendarEvents } from "./useCalendarEvents.types";

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
): TCalendarEvent => ({
  id: event.id,
  title: event.title || "(No title)",
  start: toPlainDateTime(event.startDate, timeZone),
  end: toPlainDateTime(event.endDate, timeZone),
  allDay: Boolean(event.allDay),
  color: colorById.get(event.calendarId),
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
): Promise<TDeviceResult> => {
  const { granted } = await Calendar.requestCalendarPermissionsAsync();
  if (!granted) {
    return { events: [], permissionDenied: true };
  }

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
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

  const native = await Calendar.getEventsAsync(ids, dayStart, dayEnd);
  return {
    events: native.map((event) => nativeToEvent(event, timeZone, colorById)),
    permissionDenied: false,
  };
};

/**
 * Native calendar source: events from the device's enabled calendars for the
 * viewed day.
 */
export const useCalendarEvents = (
  date: Temporal.PlainDate,
): TUseCalendarEvents => {
  const [preferences] = usePreferences();
  const [enabledIds, { isLoading: enabledLoading }] =
    useEnabledDeviceCalendars();
  const active = preferences.enableCalendar;

  const { data, isLoading, isError } = useQuery({
    // Wait for the device-local selection to load before fetching, so a cold
    // start with some calendars disabled doesn't briefly fetch (and cache)
    // every calendar under a stale `null` key.
    enabled: active && !enabledLoading,
    queryKey: ["calendarEvents", date.toString(), enabledIds],
    queryFn: () => fetchDeviceEvents(date.toString(), enabledIds),
    staleTime: STALE_TIME_MS,
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
