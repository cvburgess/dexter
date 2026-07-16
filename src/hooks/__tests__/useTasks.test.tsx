import { Temporal } from "@js-temporal/polyfill";

import { ETaskStatus } from "@/api/tasks";

import {
  notScheduledForDateFilters,
  taskFilters,
  taskFiltersForDate,
} from "../useTasks";

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

describe("notScheduledForDateFilters", () => {
  it("matches incomplete tasks unscheduled or scheduled for another day", () => {
    const date = Temporal.PlainDate.from("2026-08-15");

    expect(notScheduledForDateFilters(date)).toEqual([
      ["", "or", "scheduled_for.neq.2026-08-15,scheduled_for.is.null"],
      ["status", "in", [ETaskStatus.TODO, ETaskStatus.IN_PROGRESS]],
    ]);
  });

  it("excludes tasks scheduled for the given date", () => {
    const date = Temporal.PlainDate.from("2026-08-15");
    const [orFilter] = notScheduledForDateFilters(date);

    expect(orFilter[2]).not.toContain("scheduled_for.eq.2026-08-15");
  });
});

describe("taskFilters.notToday", () => {
  it("matches notScheduledForDateFilters for the current date, not a fixed date", () => {
    expect(taskFilters.notToday).toEqual(
      notScheduledForDateFilters(Temporal.Now.plainDateISO()),
    );
  });
});
