import { Temporal } from "@js-temporal/polyfill";

import {
  DEFAULT_TASK_REACH_DAYS,
  reachFor,
  resolveReach,
} from "@/utils/taskReach";

describe("reachFor", () => {
  // Month granularity is what keeps day-by-day swiping past the boundary from
  // refetching on every swipe (DEX-162).
  it("snaps to the first of the date's month", () => {
    expect(reachFor(Temporal.PlainDate.from("2025-03-17")).toString()).toBe(
      "2025-03-01",
    );
  });

  it("leaves a date already on the first of the month alone", () => {
    expect(reachFor(Temporal.PlainDate.from("2025-03-01")).toString()).toBe(
      "2025-03-01",
    );
  });
});

describe("resolveReach", () => {
  const today = Temporal.PlainDate.from("2026-08-14");
  const floor = today.subtract({ days: DEFAULT_TASK_REACH_DAYS });

  it("falls back to the default window when nothing older has been opened", () => {
    expect(resolveReach(null, today).toString()).toBe(floor.toString());
  });

  it("honors an explicit reach older than the default window", () => {
    const explicit = Temporal.PlainDate.from("2025-01-01");

    expect(resolveReach(explicit, today).toString()).toBe("2025-01-01");
  });

  // The reach only ever widens: an explicit value inside the default window
  // would otherwise narrow the fetch and drop rows other views are showing.
  it("never narrows below the default window", () => {
    const explicit = today.subtract({ days: 3 });

    expect(resolveReach(explicit, today).toString()).toBe(floor.toString());
  });

  // The default is relative to today rather than frozen at first read, so it
  // follows a day rollover (DEX-161).
  it("slides its default as the day changes", () => {
    const tomorrow = today.add({ days: 1 });

    expect(resolveReach(null, tomorrow).toString()).toBe(
      tomorrow.subtract({ days: DEFAULT_TASK_REACH_DAYS }).toString(),
    );
  });
});
