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

const ME = "me@example.com";

const withAttendee = (partstat: string, email = ME) =>
  wrap(
    "BEGIN:VEVENT",
    "UID:invite-1",
    "SUMMARY:Invite",
    "DTSTART:20260712T140000Z",
    "DTEND:20260712T143000Z",
    `ATTENDEE;CN=Someone;PARTSTAT=ACCEPTED:mailto:other@example.com`,
    `ATTENDEE;CN=Me;PARTSTAT=${partstat}:mailto:${email}`,
    "END:VEVENT",
  );

describe("parseIcsEventsForDate — attendee response", () => {
  it("maps the current user's NEEDS-ACTION to invited", () => {
    const events = parseIcsEventsForDate(
      withAttendee("NEEDS-ACTION"),
      DAY,
      TZ,
      ME,
    );
    expect(events).toHaveLength(1);
    expect(events[0].response).toBe("invited");
  });

  it("maps TENTATIVE to tentative and ACCEPTED to accepted", () => {
    expect(
      parseIcsEventsForDate(withAttendee("TENTATIVE"), DAY, TZ, ME)[0].response,
    ).toBe("tentative");
    expect(
      parseIcsEventsForDate(withAttendee("ACCEPTED"), DAY, TZ, ME)[0].response,
    ).toBe("accepted");
  });

  it("leaves response undefined for DECLINED", () => {
    expect(
      parseIcsEventsForDate(withAttendee("DECLINED"), DAY, TZ, ME)[0].response,
    ).toBeUndefined();
  });

  it("defaults a matched attendee with no PARTSTAT to invited (RFC 5545)", () => {
    const noPartstat = wrap(
      "BEGIN:VEVENT",
      "UID:invite-2",
      "SUMMARY:Bare invite",
      "DTSTART:20260712T140000Z",
      "DTEND:20260712T143000Z",
      `ATTENDEE;CN=Me:mailto:${ME}`,
      "END:VEVENT",
    );
    expect(parseIcsEventsForDate(noPartstat, DAY, TZ, ME)[0].response).toBe(
      "invited",
    );
  });

  it("matches the attendee email case-insensitively", () => {
    const events = parseIcsEventsForDate(
      withAttendee("NEEDS-ACTION", "Me@Example.com"),
      DAY,
      TZ,
      ME,
    );
    expect(events[0].response).toBe("invited");
  });

  it("leaves response undefined when no attendee matches the user", () => {
    const events = parseIcsEventsForDate(
      withAttendee("NEEDS-ACTION"),
      DAY,
      TZ,
      "someone-else@example.com",
    );
    expect(events[0].response).toBeUndefined();
  });

  it("leaves response undefined when no user email is provided", () => {
    const events = parseIcsEventsForDate(withAttendee("NEEDS-ACTION"), DAY, TZ);
    expect(events[0].response).toBeUndefined();
  });

  it("propagates response to every occurrence of a recurring event", () => {
    const recurringInvite = wrap(
      "BEGIN:VEVENT",
      "UID:recur-invite",
      "SUMMARY:Daily Invite",
      "DTSTART:20260701T120000Z",
      "DTEND:20260701T123000Z",
      "RRULE:FREQ=DAILY",
      `ATTENDEE;CN=Me;PARTSTAT=TENTATIVE:mailto:${ME}`,
      "END:VEVENT",
    );
    const events = parseIcsEventsForDate(recurringInvite, DAY, TZ, ME);
    expect(events).toHaveLength(1);
    expect(events[0].response).toBe("tentative");
  });
});

describe("parseIcsEventsForDate — event color", () => {
  const withColor = (color: string) =>
    wrap(
      "BEGIN:VEVENT",
      "UID:colored-1",
      "SUMMARY:Colored",
      "DTSTART:20260712T140000Z",
      "DTEND:20260712T143000Z",
      `COLOR:${color}`,
      "END:VEVENT",
    );

  it("keeps a #RRGGBB hex color", () => {
    expect(parseIcsEventsForDate(withColor("#3366ff"), DAY, TZ)[0].color).toBe(
      "#3366ff",
    );
  });

  it("drops a non-hex CSS color name (would break the hex-only withOpacity)", () => {
    // RFC 7986 permits names like `turquoise`; the app's withOpacity parses hex
    // only and would yield rgba(NaN,...), so a non-hex COLOR falls back to undefined.
    expect(
      parseIcsEventsForDate(withColor("turquoise"), DAY, TZ)[0].color,
    ).toBeUndefined();
  });
});
