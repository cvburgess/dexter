import {
  formatHourLabel,
  formatHours,
  formatTime,
  parseTimeToMinutes,
} from "../formatPlainTime";

describe("formatTime", () => {
  it("formats morning times with AM", () => {
    expect(formatTime({ hour: 9, minute: 5 })).toBe("9:05 AM");
  });

  it("uses 12 for midnight and noon", () => {
    expect(formatTime({ hour: 0, minute: 0 })).toBe("12:00 AM");
    expect(formatTime({ hour: 12, minute: 0 })).toBe("12:00 PM");
  });

  it("formats afternoon times with PM", () => {
    expect(formatTime({ hour: 20, minute: 30 })).toBe("8:30 PM");
  });
});

describe("formatHourLabel", () => {
  it("labels hours compactly", () => {
    expect(formatHourLabel(0)).toBe("12 AM");
    expect(formatHourLabel(6)).toBe("6 AM");
    expect(formatHourLabel(12)).toBe("12 PM");
    expect(formatHourLabel(23)).toBe("11 PM");
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
