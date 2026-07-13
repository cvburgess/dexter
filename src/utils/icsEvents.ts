import { Temporal } from "@js-temporal/polyfill";
import ICAL from "ical.js";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";

// Hard ceiling on recurrence expansion per event. The real terminator is
// "stop once an occurrence starts after the target day"; this only guards
// against pathological/looping RRULEs (e.g. FREQ=SECONDLY) hanging the parser.
const MAX_ITERATIONS = 10000;

/** An ICAL.Time as exposed by ical.js — typed loosely to avoid depending on internals. */
type TIcalTime = {
  isDate: boolean;
  year: number;
  month: number;
  day: number;
  toJSDate: () => Date;
};

/** Absolute instant → local wall-clock, for timed events. */
const toLocalPlainDateTime = (
  jsDate: Date,
  timeZone: string,
): Temporal.PlainDateTime =>
  Temporal.Instant.fromEpochMilliseconds(jsDate.getTime())
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime();

/** All-day times carry no zone — use their calendar fields directly. */
const allDayPlainDateTime = (time: TIcalTime): Temporal.PlainDateTime =>
  new Temporal.PlainDateTime(time.year, time.month, time.day, 0, 0);

const plainDateOf = (time: TIcalTime): Temporal.PlainDate =>
  new Temporal.PlainDate(time.year, time.month, time.day);

/**
 * Build a `TCalendarEvent` for one occurrence, or null if it doesn't intersect
 * the target day. `dayStartMs`/`dayEndMs` bound the day as absolute instants
 * (local midnight → next local midnight); `targetDate` bounds all-day events by
 * calendar date.
 */
const occurrenceToEvent = (
  uid: string,
  title: string,
  color: string | undefined,
  start: TIcalTime,
  end: TIcalTime,
  targetDate: Temporal.PlainDate,
  timeZone: string,
  dayStartMs: number,
  dayEndMs: number,
): TCalendarEvent | null => {
  if (start.isDate) {
    // All-day: [startDate, endDate) as dates (endDate is exclusive; default to
    // a single day when absent/invalid).
    const startDate = plainDateOf(start);
    let endDate = plainDateOf(end);
    if (Temporal.PlainDate.compare(endDate, startDate) <= 0) {
      endDate = startDate.add({ days: 1 });
    }
    const inRange =
      Temporal.PlainDate.compare(targetDate, startDate) >= 0 &&
      Temporal.PlainDate.compare(targetDate, endDate) < 0;
    if (!inRange) return null;
    return {
      id: `${uid}-${startDate.toString()}`,
      title,
      start: allDayPlainDateTime(start),
      end: allDayPlainDateTime(end),
      allDay: true,
      color,
    };
  }

  const startMs = start.toJSDate().getTime();
  const endMs = end.toJSDate().getTime();
  if (!(endMs > dayStartMs && startMs < dayEndMs)) return null;
  return {
    id: `${uid}-${startMs}`,
    title,
    start: toLocalPlainDateTime(start.toJSDate(), timeZone),
    end: toLocalPlainDateTime(end.toJSDate(), timeZone),
    allDay: false,
    color,
  };
};

/**
 * Parse raw `.ics` text and return the events occurring on `date`, expanding
 * recurrence rules. VTIMEZONE definitions in the feed are registered so
 * TZID-qualified times resolve to the correct absolute instant. A malformed
 * individual event is skipped rather than failing the whole feed.
 *
 * `timeZone` is the viewer's IANA zone (e.g. from `Temporal.Now.timeZoneId()`),
 * used to bound the target day; pass a fixed zone in tests for determinism.
 */
export const parseIcsEventsForDate = (
  icsText: string,
  date: Temporal.PlainDate,
  timeZone: string,
): TCalendarEvent[] => {
  let calendar: ICAL.Component;
  try {
    calendar = new ICAL.Component(ICAL.parse(icsText));
  } catch {
    return [];
  }

  // Register the feed's own timezones so toJSDate() resolves TZID times.
  for (const vtz of calendar.getAllSubcomponents("vtimezone")) {
    try {
      const tzid = vtz.getFirstPropertyValue("tzid") as string | null;
      if (tzid && !ICAL.TimezoneService.has(tzid)) {
        ICAL.TimezoneService.register(vtz);
      }
    } catch {
      // Ignore an unparseable VTIMEZONE; times fall back to floating/UTC.
    }
  }

  const dayStart = date.toZonedDateTime(timeZone);
  const dayStartMs = dayStart.toInstant().epochMilliseconds;
  const dayEndMs = dayStart.add({ days: 1 }).toInstant().epochMilliseconds;

  const events: TCalendarEvent[] = [];

  for (const vevent of calendar.getAllSubcomponents("vevent")) {
    try {
      const event = new ICAL.Event(vevent);
      // Skip recurrence-exception children; the master event owns expansion.
      if (event.isRecurrenceException()) continue;

      const uid = event.uid || `${events.length}`;
      const title = event.summary || "(No title)";
      const color =
        (vevent.getFirstPropertyValue("color") as string | null) ?? undefined;

      if (!event.isRecurring()) {
        const mapped = occurrenceToEvent(
          uid,
          title,
          color,
          event.startDate as unknown as TIcalTime,
          event.endDate as unknown as TIcalTime,
          date,
          timeZone,
          dayStartMs,
          dayEndMs,
        );
        if (mapped) events.push(mapped);
        continue;
      }

      // Recurring: iterate occurrences until one starts after the target day.
      const iterator = event.iterator();
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const next = iterator.next();
        if (!next) break;

        const nextTime = next as unknown as TIcalTime;
        if (nextTime.isDate) {
          if (Temporal.PlainDate.compare(plainDateOf(nextTime), date) > 0) break;
        } else if (next.toJSDate().getTime() >= dayEndMs) {
          break;
        }

        const details = event.getOccurrenceDetails(next);
        const mapped = occurrenceToEvent(
          uid,
          title,
          color,
          details.startDate as unknown as TIcalTime,
          details.endDate as unknown as TIcalTime,
          date,
          timeZone,
          dayStartMs,
          dayEndMs,
        );
        if (mapped) events.push(mapped);
      }
    } catch {
      // Skip a malformed event without dropping the rest of the feed.
    }
  }

  return events;
};
