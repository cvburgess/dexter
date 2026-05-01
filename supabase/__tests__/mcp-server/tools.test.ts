import { assertEquals } from "@std/assert";

import {
  cronScheduleSchema,
  getTodayIsoDate,
} from "../../functions/mcp-server/tools/helpers.ts";
import { updateDailyHabitInputSchema } from "../../functions/mcp-server/tools/habits.ts";
import { updatePreferencesInputSchema } from "../../functions/mcp-server/tools/preferences.ts";
import {
  applyTaskFilters,
  listTasksSchema,
} from "../../functions/mcp-server/tools/tasks.ts";

class QueryRecorder {
  calls: string[] = [];

  eq(column: string, value: unknown): QueryRecorder {
    this.calls.push(`eq:${column}:${String(value)}`);
    return this;
  }

  gte(column: string, value: unknown): QueryRecorder {
    this.calls.push(`gte:${column}:${String(value)}`);
    return this;
  }

  in(column: string, values: unknown[]): QueryRecorder {
    this.calls.push(`in:${column}:${values.join(",")}`);
    return this;
  }

  is(column: string, value: null): QueryRecorder {
    this.calls.push(`is:${column}:${String(value)}`);
    return this;
  }

  lte(column: string, value: unknown): QueryRecorder {
    this.calls.push(`lte:${column}:${String(value)}`);
    return this;
  }

  or(filters: string): QueryRecorder {
    this.calls.push(`or:${filters}`);
    return this;
  }
}

Deno.test("applyTaskFilters supports issue-required task filters", () => {
  const query = new QueryRecorder();
  const filters = listTasksSchema.parse({
    today: true,
    dateFrom: "2026-04-01",
    dateTo: "2026-04-30",
    dateField: "due_on",
    status: [1, 2],
    priority: 0,
    listId: null,
    goalId: "00000000-0000-4000-8000-000000000001",
    scheduledFor: "2026-04-30",
    dueOn: null,
  });

  applyTaskFilters(query, filters);

  assertEquals(query.calls, [
    `or:scheduled_for.eq.${getTodayIsoDate()},due_on.eq.${getTodayIsoDate()}`,
    "gte:due_on:2026-04-01",
    "lte:due_on:2026-04-30",
    "in:status:1,2",
    "eq:priority:0",
    "is:list_id:null",
    "eq:goal_id:00000000-0000-4000-8000-000000000001",
    "eq:scheduled_for:2026-04-30",
    "is:due_on:null",
  ]);
});

Deno.test("task filters default date ranges to scheduled_for", () => {
  const query = new QueryRecorder();
  const filters = listTasksSchema.parse({
    dateFrom: "2026-04-01",
    dateTo: "2026-04-30",
  });

  applyTaskFilters(query, filters);

  assertEquals(query.calls, [
    "gte:scheduled_for:2026-04-01",
    "lte:scheduled_for:2026-04-30",
  ]);
});

Deno.test("repeat task schedule validation mirrors database cron constraint", () => {
  assertEquals(cronScheduleSchema.safeParse("0 0 * * *").success, true);
  assertEquals(cronScheduleSchema.safeParse("0 0 1,15 * 1-5").success, true);
  assertEquals(cronScheduleSchema.safeParse("* * * * *").success, false);
  assertEquals(cronScheduleSchema.safeParse("0 12 * * *").success, false);
});

Deno.test("daily habit writes only expose stepsComplete", () => {
  assertEquals(Object.keys(updateDailyHabitInputSchema).sort(), [
    "date",
    "habitId",
    "stepsComplete",
  ]);
});

Deno.test("preference updates do not accept user ids", () => {
  assertEquals("userId" in updatePreferencesInputSchema, false);
  assertEquals("user_id" in updatePreferencesInputSchema, false);
});
