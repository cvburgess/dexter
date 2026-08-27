import { Temporal } from "@js-temporal/polyfill";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";

import { minutesFromDayStart } from "./calendarLayout";
import { parseTimeToMinutes } from "./formatPlainTime";

// `layoutEvents` is deliberately not reused: its height flooring and
// zero-length inflation are drawing decisions that would be lies in a total.

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

/** Start hour floors, end hour ceilings (06:30→20:30 shows 6 AM–9 PM). Lives here,
 * not in `CalendarView`, so the grid and the step's "Nh free" can't disagree. */
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

/** The **union** of event spans, not the sum — double-bookings cost that hour
 * once. Clamps before merging, so an overnight event contributes only its in-window part. */
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

  // Rounded once, at the end — rounding each span separately (Temporal reports
  // seconds as a minute fraction) accumulates a visible drift.
  return Math.round(total);
};

export type TCalendarSummary = {
  /** Every event, all-day and out-of-window included — the hero says "today",
   * not "on your timeline". */
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
    // Belt and braces — the merge can't exceed the window, but this keeps
    // "free is never negative" true locally.
    freeMinutes: Math.max(0, endMin - startMin - planned),
  };
};
