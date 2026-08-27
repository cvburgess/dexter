import { Temporal } from "@js-temporal/polyfill";
import ICAL from "ical.js";

import {
  TCalendarEvent,
  TEventResponse,
} from "@/hooks/useCalendarEvents.types";

// Guards against a pathological/looping RRULE (e.g. FREQ=SECONDLY) hanging
// the parser; 10000 covers ~27 years of a daily event.
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

/** CAL-ADDRESS PARTSTAT → app response; unrecognized/DECLINED map to undefined. */
const PARTSTAT_TO_RESPONSE: Record<string, TEventResponse> = {
  ACCEPTED: "accepted",
  TENTATIVE: "tentative",
  "NEEDS-ACTION": "invited",
};

/** Lowercased email from a CAL-ADDRESS value (`mailto:foo@bar.com` → `foo@bar.com`). */
const emailOf = (calAddress: string): string =>
  calAddress
    .replace(/^mailto:/i, "")
    .trim()
    .toLowerCase();

/** RFC 7986 permits CSS3 color names (e.g. `turquoise`), which the app's
 * hex-only `withOpacity` mis-parses into a fill-less block — drop non-hex instead. */
const hexColorOrUndefined = (value: unknown): string | undefined => {
  const color = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(color) ? color : undefined;
};

/** Matched against email via ATTENDEE's CAL-ADDRESS; undefined when there's no
 * matching attendee (common for subscription feeds) or no email to match on. */
const responseForUser = (
  vevent: ICAL.Component,
  userEmail: string | undefined,
): TEventResponse | undefined => {
  if (!userEmail) return undefined;
  const target = userEmail.toLowerCase();
  for (const attendee of vevent.getAllProperties("attendee")) {
    const value = attendee.getFirstValue();
    if (typeof value !== "string" || emailOf(value) !== target) continue;
    const partstat = attendee.getParameter("partstat");
    // RFC 5545 §3.2.12: an ATTENDEE with no PARTSTAT defaults to NEEDS-ACTION,
    // so a bare invite (listed, no reply) reads as "invited", not accepted.
    if (typeof partstat !== "string") return "invited";
    return PARTSTAT_TO_RESPONSE[partstat.toUpperCase()];
  }
  return undefined;
};

/** Null if the occurrence doesn't intersect the target day. `dayStartMs`/`dayEndMs`
 * bound timed events; `targetDate` bounds all-day events by calendar date. */
const occurrenceToEvent = (
  uid: string,
  title: string,
  color: string | undefined,
  response: TEventResponse | undefined,
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
      response,
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
    response,
  };
};

/** Registers the feed's VTIMEZONEs so TZID times resolve to the correct
 * instant; a malformed individual event is skipped rather than failing the whole feed. */
export const parseIcsEventsForDate = (
  icsText: string,
  date: Temporal.PlainDate,
  timeZone: string,
  userEmail?: string,
): TCalendarEvent[] => {
  let calendar: ICAL.Component;
  try {
    // ical.js declares `parse` as returning `any`; narrow the jCal array to
    // `unknown[]` rather than letting `any` leak into the call.
    calendar = new ICAL.Component(ICAL.parse(icsText) as unknown[]);
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
      const color = hexColorOrUndefined(vevent.getFirstPropertyValue("color"));
      const response = responseForUser(vevent, userEmail);

      if (!event.isRecurring()) {
        const mapped = occurrenceToEvent(
          uid,
          title,
          color,
          response,
          event.startDate,
          event.endDate,
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
          if (Temporal.PlainDate.compare(plainDateOf(nextTime), date) > 0)
            break;
        } else if (next.toJSDate().getTime() >= dayEndMs) {
          break;
        }

        const details = event.getOccurrenceDetails(next);
        const mapped = occurrenceToEvent(
          uid,
          title,
          color,
          response,
          details.startDate,
          details.endDate,
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
