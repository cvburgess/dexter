import { Temporal } from "@js-temporal/polyfill";

import { formatMonthDayYear, formatWeekdayMonthDay } from "../formatPlainDate";

describe("formatWeekdayMonthDay", () => {
  it("formats as Weekday, Mon D", () => {
    // 2026-07-03 is a Friday.
    expect(formatWeekdayMonthDay(Temporal.PlainDate.from("2026-07-03"))).toBe(
      "Friday, Jul 3",
    );
  });
});

describe("formatMonthDayYear", () => {
  it("formats as Mon D, YYYY", () => {
    expect(formatMonthDayYear(Temporal.PlainDate.from("2026-08-15"))).toBe(
      "Aug 15, 2026",
    );
  });
});
