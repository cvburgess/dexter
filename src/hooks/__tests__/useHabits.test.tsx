import { Temporal } from "@js-temporal/polyfill";

import { canBootstrapDailyHabits, habitFilters } from "../useHabits";

// useHabits imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));

describe("habitFilters.notPaused", () => {
  it("matches only unpaused habits", () => {
    expect(habitFilters.notPaused).toEqual([["isPaused", "eq", false]]);
  });
});

describe("habitFilters.activeForDay", () => {
  it("matches habits whose active days include the given weekday", () => {
    expect(habitFilters.activeForDay(3)).toEqual([
      ["daysActive", "contains", [3]],
    ]);
  });
});

// Bootstrapping writes rows, so it is bounded in both directions (DEX-162):
// future days have none by design, and inventing them for a long-past day would
// persist history that never happened.
describe("canBootstrapDailyHabits", () => {
  const today = Temporal.PlainDate.from("2026-08-14");
  const canBootstrap = (date: string) =>
    canBootstrapDailyHabits(Temporal.PlainDate.from(date), today);

  it("allows today", () => {
    expect(canBootstrap("2026-08-14")).toBe(true);
  });

  // The honest catch-up case: a day skipped last week still backfills, and
  // shows the zero progress it actually had.
  it("allows a recently skipped day", () => {
    expect(canBootstrap("2026-08-13")).toBe(true);
    expect(canBootstrap("2026-07-16")).toBe(true);
  });

  it("refuses a day past the window rather than inventing its rows", () => {
    expect(canBootstrap("2026-07-14")).toBe(false);
    expect(canBootstrap("2024-06-01")).toBe(false);
  });

  it("refuses future days, whose rings are drawn from the habits instead", () => {
    expect(canBootstrap("2026-08-15")).toBe(false);
  });
});
