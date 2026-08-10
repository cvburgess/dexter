import {
  formatDuration,
  formatHourLabel,
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

describe("formatDuration", () => {
  it("writes both parts when both are there", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });

  // A zero part is dropped rather than written out — "1h 0m" reads as a
  // rounding artefact.
  it("drops the zero part", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
  });

  // Nothing left to drop, so it falls back to the hours shape and keeps the
  // same silhouette as the figure beside it ("0h free" under "14h planned").
  it("falls back to 0h for an empty span", () => {
    expect(formatDuration(0)).toBe("0h");
  });

  it("floors a negative and rounds a fraction rather than rejecting either", () => {
    expect(formatDuration(-30)).toBe("0h");
    expect(formatDuration(89.6)).toBe("1h 30m");
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
