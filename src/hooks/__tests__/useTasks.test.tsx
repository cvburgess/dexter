import { Temporal } from "@js-temporal/polyfill";

import { taskFilters, taskFiltersForDate } from "../useTasks";

// useTasks imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));

describe("taskFiltersForDate", () => {
  it("filters tasks scheduled for the given date", () => {
    const date = Temporal.PlainDate.from("2026-08-15");

    expect(taskFiltersForDate(date)).toEqual([
      ["scheduledFor", "eq", "2026-08-15"],
    ]);
  });
});

describe("taskFilters.today", () => {
  it("matches taskFiltersForDate for the current date", () => {
    expect(taskFilters.today).toEqual(
      taskFiltersForDate(Temporal.Now.plainDateISO()),
    );
  });
});
