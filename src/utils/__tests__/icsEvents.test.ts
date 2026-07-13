import { Temporal } from "@js-temporal/polyfill";

import { parseIcsEventsForDate } from "../icsEvents";

// New York is UTC-4 in July (EDT), so UTC times below map to a known local hour.
const TZ = "America/New_York";
const DAY = Temporal.PlainDate.from("2026-07-12");

const wrap = (...vevents: string[]) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Test//EN",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

const timed = wrap(
  "BEGIN:VEVENT",
  "UID:single-1",
  "SUMMARY:Standup",
  "DTSTART:20260712T140000Z",
  "DTEND:20260712T143000Z",
  "END:VEVENT",
);

const allDay = wrap(
  "BEGIN:VEVENT",
  "UID:allday-1",
  "SUMMARY:Vacation",
  "DTSTART;VALUE=DATE:20260712",
  "DTEND;VALUE=DATE:20260713",
  "END:VEVENT",
);

const recurring = wrap(
  "BEGIN:VEVENT",
  "UID:recur-1",
  "SUMMARY:Daily Sync",
  "DTSTART:20260701T120000Z",
  "DTEND:20260701T123000Z",
  "RRULE:FREQ=DAILY",
  "END:VEVENT",
);

describe("parseIcsEventsForDate", () => {
  it("maps a timed event to local wall-clock", () => {
    const events = parseIcsEventsForDate(timed, DAY, TZ);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Standup");
    expect(events[0].allDay).toBe(false);
    expect(events[0].start.hour).toBe(10); // 14:00Z → 10:00 EDT
    expect(events[0].start.minute).toBe(0);
    expect(events[0].end.hour).toBe(10);
    expect(events[0].end.minute).toBe(30);
  });

  it("flags all-day events and includes them on covered days", () => {
    const events = parseIcsEventsForDate(allDay, DAY, TZ);
    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(true);
    expect(events[0].title).toBe("Vacation");
  });

  it("excludes all-day events outside the covered range", () => {
    const events = parseIcsEventsForDate(
      allDay,
      Temporal.PlainDate.from("2026-07-13"),
      TZ,
    );
    expect(events).toHaveLength(0);
  });

  it("expands a recurring event onto the target day", () => {
    const events = parseIcsEventsForDate(recurring, DAY, TZ);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Daily Sync");
    expect(events[0].start.hour).toBe(8); // 12:00Z → 8:00 EDT
  });

  it("excludes single events on other days", () => {
    const events = parseIcsEventsForDate(
      timed,
      Temporal.PlainDate.from("2026-07-11"),
      TZ,
    );
    expect(events).toHaveLength(0);
  });

  it("returns an empty array for malformed input", () => {
    expect(parseIcsEventsForDate("not a calendar", DAY, TZ)).toEqual([]);
  });
});
