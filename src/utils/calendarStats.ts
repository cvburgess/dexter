import { Temporal } from "@js-temporal/polyfill";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";

import { minutesFromDayStart } from "./calendarLayout";
import { parseTimeToMinutes } from "./formatPlainTime";

/**
 * How a day reads once you count it: what the ritual's Calendar step (DEX-140)
 * says above the timeline.
 *
 * React-free and import-light, the same leaf discipline `calendarLayout` keeps,
 * so every rule here is unit-testable without a native host. It measures the
 * very same events that module draws — hence the matching `(events, date,
 * startMin, endMin)` argument order — but in minutes rather than pixels, and
 * `layoutEvents` is deliberately *not* reused: it floors block heights and
 * inflates a zero-length event to fifteen minutes so it stays visible, both of
 * which would be lies in a total.
 */

/** Fallback window if stored times are missing or inverted. */
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 20;

const MINUTES_PER_HOUR = 60;

export type TCalendarWindow = {
  startHour: number;
  endHour: number;
  startMin: number;
  endMin: number;
};

/**
 * The whole-hour window the timeline draws, from the stored `"HH:MM:SS"`
 * preferences: the start hour floors and the end hour ceilings, so a 06:30→20:30
 * setting shows 6 AM through 9 PM and every event inside it.
 *
 * Lives here rather than in `CalendarView` because two surfaces now depend on
 * it — the grid and the step's "Nh free" — and a window derived twice is a
 * window that can disagree with the picture underneath it.
 */
export const calendarWindow = (
  startTime: string,
  endTime: string,
): TCalendarWindow => {
  const startHour = Math.floor(
    parseTimeToMinutes(startTime) / MINUTES_PER_HOUR,
  );
  const endHour = Math.ceil(parseTimeToMinutes(endTime) / MINUTES_PER_HOUR);
  if (!(endHour > startHour)) {
    return {
      startHour: DEFAULT_START_HOUR,
      endHour: DEFAULT_END_HOUR,
      startMin: DEFAULT_START_HOUR * MINUTES_PER_HOUR,
      endMin: DEFAULT_END_HOUR * MINUTES_PER_HOUR,
    };
  }
  return {
    startHour,
    endHour,
    startMin: startHour * MINUTES_PER_HOUR,
    endMin: endHour * MINUTES_PER_HOUR,
  };
};

/**
 * Minutes of `[startMin, endMin]` actually occupied by timed events — the
 * **union** of their spans, not the sum. Two meetings booked over each other
 * cost that hour once; a day full of double-bookings is not a 30-hour day.
 *
 * Clamps before it merges, which is what makes an event running in from
 * yesterday contribute only its in-window part rather than a negative span or a
 * whole night. All-day events are excluded (they are counted, not timed — see
 * `summarizeDay`), as is anything that lands entirely outside the window and
 * anything of zero length.
 */
export const plannedMinutes = (
  events: TCalendarEvent[],
  date: Temporal.PlainDate,
  startMin: number,
  endMin: number,
): number => {
  const dayStart = date.toPlainDateTime();

  const spans = events
    .filter((event) => !event.allDay)
    .map((event) => ({
      start: Math.max(minutesFromDayStart(event.start, dayStart), startMin),
      end: Math.min(minutesFromDayStart(event.end, dayStart), endMin),
    }))
    .filter((span) => span.end > span.start)
    .sort((a, b) => a.start - b.start);

  let total = 0;
  let cursor = -Infinity;
  for (const span of spans) {
    total += Math.max(0, span.end - Math.max(span.start, cursor));
    cursor = Math.max(cursor, span.end);
  }

  // Rounded once, at the end: Temporal reports a span carrying seconds as a
  // fraction of a minute, and rounding each of a dozen of those separately
  // accumulates a visible drift into the figure on screen.
  return Math.round(total);
};

export type TCalendarSummary = {
  /**
   * Every event the day returned, all-day ones and any that fall outside the
   * window included. The hero says "today", not "on your timeline" — a 5 AM
   * standup under a 6 AM window is still something the user did today, and
   * hiding it from the count contradicts their memory of their own morning.
   */
  eventCount: number;
  plannedMinutes: number;
  freeMinutes: number;
};

/** The day's three numbers, measured against the window the timeline draws. */
export const summarizeDay = (
  events: TCalendarEvent[],
  date: Temporal.PlainDate,
  startMin: number,
  endMin: number,
): TCalendarSummary => {
  const planned = plannedMinutes(events, date, startMin, endMin);
  return {
    eventCount: events.length,
    plannedMinutes: planned,
    // The merge cannot exceed the window, so the clamp is belt and braces —
    // but it keeps "free is never negative" true locally rather than by
    // reasoning about the function above.
    freeMinutes: Math.max(0, endMin - startMin - planned),
  };
};
