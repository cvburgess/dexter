import { habitFilters } from "../useHabits";

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
