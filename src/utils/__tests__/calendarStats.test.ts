import { Temporal } from "@js-temporal/polyfill";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";

import { calendarWindow, plannedMinutes, summarizeDay } from "../calendarStats";

const DATE = Temporal.PlainDate.from("2026-07-12");

const pdt = (day: number, hour: number, minute = 0) =>
  new Temporal.PlainDateTime(2026, 7, day, hour, minute);

const event = (
  id: string,
  start: Temporal.PlainDateTime,
  end: Temporal.PlainDateTime,
  allDay = false,
): TCalendarEvent => ({ id, title: id, start, end, allDay });

/** A timed event on the viewed day, in whole/half hours. */
const timed = (id: string, startHour: number, endHour: number) =>
  event(id, pdt(12, startHour), pdt(12, endHour));

// The default window: 6:00 (360) → 20:00 (1200), fourteen hours.
const START = 360;
const END = 1200;

const planned = (events: TCalendarEvent[]) =>
  plannedMinutes(events, DATE, START, END);

describe("calendarWindow", () => {
  it("snaps to the whole hours that contain the stored times", () => {
    expect(calendarWindow("06:30:00", "20:30:00")).toEqual({
      startHour: 6,
      endHour: 21,
      startMin: 360,
      endMin: 1260,
    });
  });

  it("passes whole hours through unchanged", () => {
    expect(calendarWindow("08:00:00", "17:00:00")).toMatchObject({
      startHour: 8,
      endHour: 17,
    });
  });

  it.each([
    ["inverted", "20:00:00", "06:00:00"],
    ["equal", "09:00:00", "09:00:00"],
    ["unparseable", "", ""],
  ])("falls back to 6→20 for %s times", (_label, start, end) => {
    expect(calendarWindow(start, end)).toMatchObject({
      startHour: 6,
      endHour: 20,
    });
  });
});

describe("plannedMinutes", () => {
  it("is zero for a day with nothing on it", () => {
    expect(planned([])).toBe(0);
  });

  it("sums events that don't touch", () => {
    expect(
      planned([timed("a", 9, 10), event("b", pdt(12, 14), pdt(12, 15, 30))]),
    ).toBe(150);
  });

  // The whole point of the number: two meetings booked over each other cost
  // that hour once. Summing would report a 30-hour day back to the user.
  it("counts an overlap once", () => {
    expect(planned([timed("a", 10, 11), timed("b", 10, 11)])).toBe(60);
  });

  it("counts a nested event once", () => {
    expect(planned([timed("outer", 9, 12), timed("inner", 10, 11)])).toBe(180);
  });

  it("counts a partial overlap once", () => {
    expect(planned([timed("a", 9, 11), timed("b", 10, 12)])).toBe(180);
  });

  // The seam between back-to-back meetings is the easiest place for a sweep to
  // double-count a minute.
  it("doesn't double-count the seam between touching events", () => {
    expect(planned([timed("a", 9, 10), timed("b", 10, 11)])).toBe(120);
  });

  it("orders by start rather than trusting the input order", () => {
    expect(planned([timed("late", 14, 15), timed("early", 9, 10)])).toBe(120);
  });

  it("clamps an event that started the day before", () => {
    expect(planned([event("overnight", pdt(11, 22), pdt(12, 9))])).toBe(180);
  });

  it("clamps an event that runs into the next day", () => {
    expect(planned([event("late", pdt(12, 19), pdt(13, 2))])).toBe(60);
  });

  it("clamps an event that starts before the window opens", () => {
    expect(planned([timed("standup", 5, 7)])).toBe(60);
  });

  it("ignores an event entirely outside the window", () => {
    expect(planned([timed("dawn", 4, 5), timed("dusk", 21, 22)])).toBe(0);
  });

  // `layoutEvents` inflates one of these to fifteen minutes so the block stays
  // visible; that is a drawing decision, and it must not leak into a total.
  it("gives a zero-length event no minutes", () => {
    expect(planned([timed("reminder", 10, 10)])).toBe(0);
  });

  it("ignores an inverted event", () => {
    expect(planned([timed("broken", 12, 9)])).toBe(0);
  });

  it("excludes all-day events", () => {
    expect(
      planned([
        event("holiday", pdt(12, 0), pdt(13, 0), true),
        timed("a", 9, 10),
      ]),
    ).toBe(60);
  });

  // Temporal reports a span carrying seconds as a fraction of a minute, so a
  // handful of them must not accumulate a drift into the figure on screen.
  it("rounds the total once, not each span", () => {
    const withSeconds = [1, 2, 3].map((n) =>
      event(
        `s${n}`,
        new Temporal.PlainDateTime(2026, 7, 12, 8 + n, 0, 30),
        new Temporal.PlainDateTime(2026, 7, 12, 8 + n, 30, 30),
      ),
    );

    expect(planned(withSeconds)).toBe(90);
  });
});

describe("summarizeDay", () => {
  const summarize = (events: TCalendarEvent[]) =>
    summarizeDay(events, DATE, START, END);

  it("splits the window between planned and free", () => {
    const summary = summarize([timed("a", 9, 11), timed("b", 14, 15)]);

    expect(summary).toEqual({
      eventCount: 2,
      plannedMinutes: 180,
      freeMinutes: END - START - 180,
    });
  });

  it("is a whole free window with nothing scheduled", () => {
    expect(summarize([])).toEqual({
      eventCount: 0,
      plannedMinutes: 0,
      freeMinutes: 840,
    });
  });

  // The hero says "today", not "on your timeline" — an all-day event counts
  // even though it occupies no minute of the window drawn beneath it.
  it("counts events it doesn't time", () => {
    const summary = summarize([
      event("holiday", pdt(12, 0), pdt(13, 0), true),
      timed("dawn", 4, 5),
    ]);

    expect(summary).toMatchObject({
      eventCount: 2,
      plannedMinutes: 0,
      freeMinutes: 840,
    });
  });

  it("leaves no free time on a fully booked day", () => {
    expect(summarize([timed("marathon", 6, 20)])).toMatchObject({
      plannedMinutes: 840,
      freeMinutes: 0,
    });
  });
});
