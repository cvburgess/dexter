import {
  buildSchedule,
  describeSchedule,
  getNextOccurrence,
  getNextTaskDate,
  parseSchedule,
} from "@/utils/repeatSchedule";

describe("getNextOccurrence", () => {
  it("returns the next day for a daily schedule", () => {
    expect(getNextOccurrence("0 0 * * *", "2026-07-12")).toBe("2026-07-13");
  });

  it("returns the next matching weekday for a weekly schedule", () => {
    // 2026-07-15 is a Wednesday; the next Monday is 2026-07-20.
    expect(getNextOccurrence("0 0 * * 1", "2026-07-15")).toBe("2026-07-20");
  });

  it("supports multiple weekdays", () => {
    // Mondays and Wednesdays, from a Wednesday, lands on the next Monday.
    expect(getNextOccurrence("0 0 * * 1,3", "2026-07-15")).toBe("2026-07-20");
  });

  it("returns the next matching day-of-month for a monthly schedule", () => {
    expect(getNextOccurrence("0 0 15 * *", "2026-07-12")).toBe("2026-07-15");
  });

  it("skips to the following month when the reference is on the matching day", () => {
    // Strictly after the reference date, so the 15th itself is excluded.
    expect(getNextOccurrence("0 0 15 * *", "2026-07-15")).toBe("2026-08-15");
  });

  it("returns next year for a yearly schedule already passed this year", () => {
    expect(getNextOccurrence("0 0 4 7 *", "2026-07-12")).toBe("2027-07-04");
  });

  it("returns null for a null or empty schedule", () => {
    expect(getNextOccurrence(null, "2026-07-12")).toBeNull();
    expect(getNextOccurrence(undefined, "2026-07-12")).toBeNull();
  });

  it("returns null for an invalid cron expression", () => {
    expect(getNextOccurrence("not a cron", "2026-07-12")).toBeNull();
  });

  it("returns null for an impossible calendar date", () => {
    expect(getNextOccurrence("0 0 31 2 *", "2026-01-01")).toBeNull();
  });
});

describe("getNextTaskDate", () => {
  it("anchors to the scheduled date when it is later than today", () => {
    // Rescheduled forward: cadence follows the new date, not today.
    expect(
      getNextTaskDate(
        { scheduledFor: "2026-07-20" },
        "0 0 * * *",
        "2026-07-12",
      ),
    ).toBe("2026-07-21");
  });

  it("anchors to today when the scheduled date is in the past", () => {
    // A daily task completed late doesn't spawn an already-overdue occurrence.
    expect(
      getNextTaskDate(
        { scheduledFor: "2026-07-05" },
        "0 0 * * *",
        "2026-07-12",
      ),
    ).toBe("2026-07-13");
  });

  it("uses today when the task has no scheduled date", () => {
    expect(
      getNextTaskDate({ scheduledFor: null }, "0 0 * * *", "2026-07-12"),
    ).toBe("2026-07-13");
  });

  it("returns null when there is no schedule", () => {
    expect(
      getNextTaskDate({ scheduledFor: "2026-07-12" }, null, "2026-07-12"),
    ).toBeNull();
  });
});

describe("buildSchedule", () => {
  it("builds a daily cron", () => {
    expect(buildSchedule({ frequency: "daily" })).toBe("0 0 * * *");
  });

  it("builds a weekly cron from sorted, de-duplicated weekdays", () => {
    expect(buildSchedule({ frequency: "weekly", weekdays: [3, 1, 3] })).toBe(
      "0 0 * * 1,3",
    );
  });

  it("builds a monthly cron", () => {
    expect(buildSchedule({ frequency: "monthly", dayOfMonth: 15 })).toBe(
      "0 0 15 * *",
    );
  });

  it("builds a yearly cron", () => {
    expect(
      buildSchedule({ frequency: "yearly", month: 7, dayOfMonth: 4 }),
    ).toBe("0 0 4 7 *");
  });
});

describe("parseSchedule", () => {
  it("round-trips each frequency", () => {
    expect(parseSchedule("0 0 * * *")).toEqual({ frequency: "daily" });
    expect(parseSchedule("0 0 * * 1,3")).toEqual({
      frequency: "weekly",
      weekdays: [1, 3],
    });
    expect(parseSchedule("0 0 15 * *")).toEqual({
      frequency: "monthly",
      dayOfMonth: 15,
    });
    expect(parseSchedule("0 0 4 7 *")).toEqual({
      frequency: "yearly",
      month: 7,
      dayOfMonth: 4,
    });
  });

  it("normalizes cron Sunday (7) to 0", () => {
    expect(parseSchedule("0 0 * * 7")).toEqual({
      frequency: "weekly",
      weekdays: [0],
    });
  });

  it("falls back to daily for null or non-preset schedules", () => {
    expect(parseSchedule(null)).toEqual({ frequency: "daily" });
    expect(parseSchedule("0 0 */2 * *")).toEqual({ frequency: "daily" });
  });
});

describe("describeSchedule", () => {
  it("describes each frequency", () => {
    expect(describeSchedule("0 0 * * *")).toBe("Every day");
    expect(describeSchedule("0 0 * * 1,3")).toBe("Weekly on Mon, Wed");
    expect(describeSchedule("0 0 15 * *")).toBe("Monthly on the 15th");
    expect(describeSchedule("0 0 4 7 *")).toBe("Yearly on Jul 4");
  });

  it("uses correct ordinals for day-of-month", () => {
    expect(describeSchedule("0 0 1 * *")).toBe("Monthly on the 1st");
    expect(describeSchedule("0 0 2 * *")).toBe("Monthly on the 2nd");
    expect(describeSchedule("0 0 3 * *")).toBe("Monthly on the 3rd");
    expect(describeSchedule("0 0 11 * *")).toBe("Monthly on the 11th");
    expect(describeSchedule("0 0 21 * *")).toBe("Monthly on the 21st");
  });
});
