import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { assert, assertEquals } from "@std/assert";

import type { ToolContext } from "../../functions/mcp-server/server.ts";
import {
  cronScheduleSchema,
  getTodayIsoDate,
} from "../../functions/mcp-server/tools/helpers.ts";
import {
  registerHabitTools,
  updateDailyHabitInputSchema,
} from "../../functions/mcp-server/tools/habits.ts";
import { updatePreferencesInputSchema } from "../../functions/mcp-server/tools/preferences.ts";
import {
  applyTaskFilters,
  listTasksSchema,
  registerTaskTools,
} from "../../functions/mcp-server/tools/tasks.ts";

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

class ToolRegistry {
  readonly tools = new Map<
    string,
    { inputSchema?: Record<string, unknown>; handler: ToolHandler }
  >();

  registerTool(
    name: string,
    config: { inputSchema?: Record<string, unknown> },
    handler: ToolHandler,
  ): void {
    this.tools.set(name, { inputSchema: config.inputSchema, handler });
  }

  run(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Missing tool: ${name}`);
    return tool.handler(args);
  }
}

class FakeMutationBuilder {
  readonly filters: string[] = [];
  payload: Record<string, unknown> | null = null;

  constructor(readonly table: string) {}

  insert(payload: Record<string, unknown>): FakeMutationBuilder {
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>): FakeMutationBuilder {
    this.payload = payload;
    return this;
  }

  select(): FakeMutationBuilder {
    return this;
  }

  eq(column: string, value: unknown): FakeMutationBuilder {
    this.filters.push(`eq:${column}:${String(value)}`);
    return this;
  }

  single(): Promise<{ data: Record<string, unknown>; error: null }> {
    return Promise.resolve({ data: { ok: true }, error: null });
  }
}

class FakeSupabase {
  lastBuilder: FakeMutationBuilder | null = null;

  from(table: string): FakeMutationBuilder {
    this.lastBuilder = new FakeMutationBuilder(table);
    return this.lastBuilder;
  }
}

function makeToolContext(
  fakeSupabase: FakeSupabase,
  userId: string,
): ToolContext {
  return {
    supabase: fakeSupabase as unknown as ToolContext["supabase"],
    userId,
  };
}

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

Deno.test("create_task derives user_id from authenticated context", async () => {
  const registry = new ToolRegistry();
  const supabase = new FakeSupabase();
  const userId = "00000000-0000-4000-8000-0000000000aa";

  registerTaskTools(
    registry as unknown as McpServer,
    makeToolContext(supabase, userId),
  );

  await registry.run("create_task", { title: "Plan tomorrow" });

  const payload = supabase.lastBuilder?.payload;
  assert(payload);
  assertEquals(payload.user_id, userId);
  assertEquals(payload.title, "Plan tomorrow");
  assertEquals("userId" in payload, false);
  assertEquals(
    "user_id" in (registry.tools.get("create_task")?.inputSchema ?? {}),
    false,
  );
});

Deno.test("update_daily_habit only writes steps_complete", async () => {
  const registry = new ToolRegistry();
  const supabase = new FakeSupabase();
  const userId = "00000000-0000-4000-8000-0000000000aa";

  registerHabitTools(
    registry as unknown as McpServer,
    makeToolContext(supabase, userId),
  );

  await registry.run("update_daily_habit", {
    date: "2026-04-30",
    habitId: "00000000-0000-4000-8000-0000000000bb",
    stepsComplete: 3,
  });

  const builder = supabase.lastBuilder;
  assert(builder);
  const payload = builder.payload;
  assert(payload);
  assertEquals(payload, { steps_complete: 3 });
  assertEquals(builder.filters, [
    "eq:date:2026-04-30",
    "eq:habit_id:00000000-0000-4000-8000-0000000000bb",
    `eq:user_id:${userId}`,
  ]);
  assertEquals("percent_complete" in payload, false);
  assertEquals("user_id" in payload, false);
});
