import { Temporal } from "@js-temporal/polyfill";

import { weekDays, weekOf, weekStartEnd } from "../weekStartEnd";

describe("weekOf", () => {
  // 2026-07-27 is a Monday, so this run covers every weekday of one week.
  const monday = Temporal.PlainDate.from("2026-07-27");

  it.each([
    ["Monday", "2026-07-27"],
    ["Tuesday", "2026-07-28"],
    ["Wednesday", "2026-07-29"],
    ["Thursday", "2026-07-30"],
    ["Friday", "2026-07-31"],
    ["Saturday", "2026-08-01"],
    ["Sunday", "2026-08-02"],
  ])("anchors %s on the same Monday", (_weekday, iso) => {
    const week = weekOf(Temporal.PlainDate.from(iso));
    expect(week.monday.toString()).toBe("2026-07-27");
    expect(week.sunday.toString()).toBe("2026-08-02");
  });

  it("is idempotent — the week of a Monday starts on that Monday", () => {
    expect(weekOf(monday).monday.toString()).toBe(monday.toString());
  });

  it("spans a month boundary without rolling into the wrong week", () => {
    // 2026-08-01 is a Saturday, so its week starts in July.
    const week = weekOf(Temporal.PlainDate.from("2026-08-01"));
    expect(week.monday.toString()).toBe("2026-07-27");
    expect(week.sunday.toString()).toBe("2026-08-02");
  });

  it("spans a year boundary", () => {
    // 2027-01-01 is a Friday; its week starts 2026-12-28.
    const week = weekOf(Temporal.PlainDate.from("2027-01-01"));
    expect(week.monday.toString()).toBe("2026-12-28");
    expect(week.sunday.toString()).toBe("2027-01-03");
  });
});

describe("weekDays", () => {
  it("returns the seven consecutive days from Monday", () => {
    const days = weekDays(Temporal.PlainDate.from("2026-07-27"));
    expect(days.map(String)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("starts on Monday and ends on Sunday", () => {
    const days = weekDays(weekOf(Temporal.Now.plainDateISO()).monday);
    expect(days[0].dayOfWeek).toBe(1);
    expect(days[6].dayOfWeek).toBe(7);
  });
});

describe("weekStartEnd", () => {
  // Asserted relationally rather than against fixed dates: this one reads the
  // real clock, so pinning it to a literal would rot.
  it("defaults to the week containing today", () => {
    const today = Temporal.Now.plainDateISO();
    const { monday, sunday } = weekStartEnd();
    expect(monday.dayOfWeek).toBe(1);
    expect(Temporal.PlainDate.compare(monday, today)).toBeLessThanOrEqual(0);
    expect(Temporal.PlainDate.compare(today, sunday)).toBeLessThanOrEqual(0);
    expect(monday.until(sunday).days).toBe(6);
  });

  it("offsets by whole weeks", () => {
    const base = weekStartEnd().monday;
    expect(weekStartEnd(1).monday.toString()).toBe(
      base.add({ days: 7 }).toString(),
    );
    expect(weekStartEnd(-2).monday.toString()).toBe(
      base.subtract({ days: 14 }).toString(),
    );
  });

  it("agrees with weekOf for the current week", () => {
    expect(weekStartEnd().monday.toString()).toBe(
      weekOf(Temporal.Now.plainDateISO()).monday.toString(),
    );
  });
});
