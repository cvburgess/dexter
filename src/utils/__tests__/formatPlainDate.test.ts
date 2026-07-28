import { Temporal } from "@js-temporal/polyfill";

import {
  formatMonthDay,
  formatMonthDayYear,
  formatWeekday,
  formatWeekdayMonthDay,
} from "../formatPlainDate";

describe("formatWeekdayMonthDay", () => {
  it("formats as Weekday, Mon D", () => {
    // 2026-07-03 is a Friday.
    expect(formatWeekdayMonthDay(Temporal.PlainDate.from("2026-07-03"))).toBe(
      "Friday, Jul 3",
    );
  });
});

describe("formatWeekday", () => {
  it.each([
    ["2026-07-27", "Monday"],
    ["2026-07-29", "Wednesday"],
    ["2026-08-02", "Sunday"],
  ])("names the weekday for %s", (iso, expected) => {
    expect(formatWeekday(Temporal.PlainDate.from(iso))).toBe(expected);
  });
});

describe("formatMonthDay", () => {
  it("formats as M/D", () => {
    expect(formatMonthDay(Temporal.PlainDate.from("2026-07-26"))).toBe("7/26");
  });

  it("leaves both parts unpadded", () => {
    expect(formatMonthDay(Temporal.PlainDate.from("2026-01-03"))).toBe("1/3");
  });

  it("formats a two-digit month", () => {
    expect(formatMonthDay(Temporal.PlainDate.from("2026-12-25"))).toBe("12/25");
  });
});

describe("formatMonthDayYear", () => {
  it("formats as Mon D, YYYY", () => {
    expect(formatMonthDayYear(Temporal.PlainDate.from("2026-08-15"))).toBe(
      "Aug 15, 2026",
    );
  });
});
