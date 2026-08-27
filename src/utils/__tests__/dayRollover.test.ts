import { Temporal } from "@js-temporal/polyfill";

import { msUntilNextDay } from "../dayRollover";

const HOUR = 60 * 60 * 1000;
const SLACK = 1000;

const at = (iso: string, zone = "UTC") =>
  Temporal.ZonedDateTime.from(`${iso}[${zone}]`);

describe("msUntilNextDay", () => {
  it("measures to the next midnight, plus its slack", () => {
    expect(msUntilNextDay(at("2026-08-14T12:00"))).toBe(12 * HOUR + SLACK);
  });

  it("still returns a positive delay a minute before the boundary", () => {
    expect(msUntilNextDay(at("2026-08-14T23:59"))).toBe(60_000 + SLACK);
  });

  it("returns a whole day from midnight itself", () => {
    expect(msUntilNextDay(at("2026-08-14T00:00"))).toBe(24 * HOUR + SLACK);
  });

  // A plain wall-clock subtraction is an hour wrong on these two days — arming
  // early is harmless, but an hour late spends an hour of the new day on the old.
  it("drops the hour a spring-forward day skips", () => {
    // 01:00 to midnight reads as 23 hours on the wall clock, but 02:00 never
    // happens, so only 22 hours elapse.
    expect(msUntilNextDay(at("2026-03-08T01:00", "America/New_York"))).toBe(
      22 * HOUR + SLACK,
    );
  });

  it("adds the hour a fall-back day repeats", () => {
    expect(msUntilNextDay(at("2026-11-01T00:00", "America/New_York"))).toBe(
      25 * HOUR + SLACK,
    );
  });
});
