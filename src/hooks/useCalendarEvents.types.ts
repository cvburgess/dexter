import { Temporal } from "@js-temporal/polyfill";

// `undefined` (unknown/organizer/no attendee data) renders as a normal
// accepted block; `"invited"` means needs-action / not yet responded.
export type TEventResponse = "accepted" | "tentative" | "invited";

// Normalized to the app's Temporal types so the timeline renders identically
// regardless of source. `start`/`end` are wall-clock times in the local zone.
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
  /** Current user's RSVP; drives the "hollow" invited/tentative treatment. */
  response?: TEventResponse;
};

// Mirrors the `[value, meta]` tuple shape used by `useTasks`/`useNotes`.
export type TUseCalendarEvents = [
  TCalendarEvent[],
  {
    isLoading: boolean;
    /** The device read failed (native), or every configured feed failed (web). */
    isError: boolean;
    /** Native only: calendar permission was denied. Always false on web. */
    permissionDenied: boolean;
    /** No source configured. False while isLoading on native — check that
     * first or a configured user briefly sees the setup prompt on cold open. */
    notConfigured: boolean;
  },
];
