import {
  formatHourLabel,
  formatTime,
  minutesToTimeString,
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

describe("parseTimeToMinutes", () => {
  it("parses HH:MM:SS into minutes past midnight", () => {
    expect(parseTimeToMinutes("06:00:00")).toBe(360);
    expect(parseTimeToMinutes("20:30:00")).toBe(1230);
  });

  it("tolerates HH:MM without seconds", () => {
    expect(parseTimeToMinutes("09:15")).toBe(555);
  });
});

describe("minutesToTimeString", () => {
  it("round-trips with parseTimeToMinutes", () => {
    expect(minutesToTimeString(360)).toBe("06:00:00");
    expect(minutesToTimeString(1230)).toBe("20:30:00");
  });

  it("clamps out-of-range minutes", () => {
    expect(minutesToTimeString(-10)).toBe("00:00:00");
    expect(minutesToTimeString(24 * 60 + 30)).toBe("24:00:00");
  });
});
