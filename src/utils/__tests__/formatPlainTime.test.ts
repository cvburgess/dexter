import {
  formatHourLabel,
  formatHours,
  formatTime,
  formatTimeRange,
  parseTimeToMinutes,
} from "../formatPlainTime";

describe("formatTime", () => {
  it("formats morning times with AM", () => {
    expect(formatTime({ hour: 9, minute: 5 }, false)).toBe("9:05 AM");
  });

  it("uses 12 for midnight and noon", () => {
    expect(formatTime({ hour: 0, minute: 0 }, false)).toBe("12:00 AM");
    expect(formatTime({ hour: 12, minute: 0 }, false)).toBe("12:00 PM");
  });

  it("formats afternoon times with PM", () => {
    expect(formatTime({ hour: 20, minute: 30 }, false)).toBe("8:30 PM");
  });
});

describe("formatTimeRange", () => {
  it("states the period once when both ends share it", () => {
    expect(
      formatTimeRange({ hour: 16, minute: 0 }, { hour: 17, minute: 15 }, false),
    ).toBe("4:00-5:15 PM");
  });

  // The case the shared-period form cannot cover: dropped, a reader would have
  // to guess which side of noon a meeting starts on.
  it("states both when the span crosses noon", () => {
    expect(
      formatTimeRange({ hour: 11, minute: 30 }, { hour: 13, minute: 0 }, false),
    ).toBe("11:30 AM-1:00 PM");
  });

  it("treats noon as PM and midnight as AM", () => {
    expect(
      formatTimeRange({ hour: 12, minute: 0 }, { hour: 12, minute: 45 }, false),
    ).toBe("12:00-12:45 PM");
    expect(
      formatTimeRange({ hour: 0, minute: 0 }, { hour: 1, minute: 30 }, false),
    ).toBe("12:00-1:30 AM");
  });
});

describe("formatHourLabel", () => {
  it("labels hours compactly", () => {
    expect(formatHourLabel(0, false)).toBe("12 AM");
    expect(formatHourLabel(6, false)).toBe("6 AM");
    expect(formatHourLabel(12, false)).toBe("12 PM");
    expect(formatHourLabel(23, false)).toBe("11 PM");
  });
});

describe("on a 24-hour clock (DEX-223)", () => {
  it("formats times unpadded with no period", () => {
    expect(formatTime({ hour: 15, minute: 0 }, true)).toBe("15:00");
    expect(formatTime({ hour: 9, minute: 5 }, true)).toBe("9:05");
    expect(formatTime({ hour: 0, minute: 0 }, true)).toBe("0:00");
  });

  it("formats ranges with no period, even across noon", () => {
    expect(
      formatTimeRange({ hour: 15, minute: 0 }, { hour: 16, minute: 15 }, true),
    ).toBe("15:00-16:15");
    expect(
      formatTimeRange({ hour: 11, minute: 0 }, { hour: 13, minute: 0 }, true),
    ).toBe("11:00-13:00");
  });

  it("labels the hour gutter as H:00", () => {
    expect(formatHourLabel(9, true)).toBe("9:00");
    expect(formatHourLabel(0, true)).toBe("0:00");
    expect(formatHourLabel(24, true)).toBe("0:00");
  });
});

describe("formatHours", () => {
  it("writes a whole number of hours without a decimal part", () => {
    expect(formatHours(60)).toBe("1");
    expect(formatHours(120)).toBe("2");
    expect(formatHours(0)).toBe("0");
  });

  // Only the places that are needed: never "1.00" or "1.50", which read as a
  // precision the clock arithmetic behind them does not have.
  it("keeps only the decimal places it needs", () => {
    expect(formatHours(90)).toBe("1.5");
    expect(formatHours(75)).toBe("1.25");
    expect(formatHours(45)).toBe("0.75");
  });

  // Two places at most. A third would be a minute-level distinction written in
  // a unit nobody reads at that resolution.
  it("rounds to two decimal places", () => {
    expect(formatHours(50)).toBe("0.83");
    expect(formatHours(80)).toBe("1.33");
  });

  it("clamps a negative rather than rejecting it", () => {
    expect(formatHours(-30)).toBe("0");
  });
});

describe("parseTimeToMinutes", () => {
  it("parses HH:MM:SS into minutes past midnight", () => {
    expect(parseTimeToMinutes("06:00:00")).toBe(360);
    expect(parseTimeToMinutes("20:30:00")).toBe(1230);
  });

  it("tolerates HH:MM without seconds", () => {
    expect(parseTimeToMinutes("09:15")).toBe(555);
  });
});
