import { Temporal } from "@js-temporal/polyfill";

/**
 * A single calendar event normalized to the app's Temporal types, so the
 * timeline renders identically regardless of source (native device calendars on
 * iOS/Android, proxied `.ics` feeds on web). `start`/`end` are wall-clock times
 * in the viewer's local zone.
 */
export type TCalendarEvent = {
  /** Stable id for React keys — the event's UID (or a derived per-occurrence id). */
  id: string;
  title: string;
  start: Temporal.PlainDateTime;
  end: Temporal.PlainDateTime;
  /** All-day events render in a pinned header row rather than on the timeline. */
  allDay: boolean;
  /** Source calendar color, when available, for the event block accent. */
  color?: string;
};

/**
 * The events for the viewed day plus load/permission state. Mirrors the
 * `[value, meta]` tuple shape used by `useTasks`/`useDays`.
 */
export type TUseCalendarEvents = [
  TCalendarEvent[],
  {
    isLoading: boolean;
    /** A feed/device read failed (all sources, or at least one on web). */
    isError: boolean;
    /** Native only: calendar permission was denied. Always false on web. */
    permissionDenied: boolean;
  },
];
