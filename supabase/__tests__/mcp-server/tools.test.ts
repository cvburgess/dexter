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
import { registerJournalTools } from "../../functions/mcp-server/tools/journals.ts";
import { registerNoteTools } from "../../functions/mcp-server/tools/notes.ts";
import { updatePreferencesInputSchema } from "../../functions/mcp-server/tools/preferences.ts";
import {
  registerSearchTools,
  searchSchema,
} from "../../functions/mcp-server/tools/search.ts";
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
  upsertOptions: Record<string, unknown> | null = null;

  constructor(
    readonly table: string,
    readonly row: Record<string, unknown> | null,
  ) {}

  insert(payload: Record<string, unknown>): FakeMutationBuilder {
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>): FakeMutationBuilder {
    this.payload = payload;
    return this;
  }

  upsert(
    payload: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): FakeMutationBuilder {
    this.payload = payload;
    this.upsertOptions = options ?? null;
    return this;
  }

  select(): FakeMutationBuilder {
    return this;
  }

  eq(column: string, value: unknown): FakeMutationBuilder {
    this.filters.push(`eq:${column}:${String(value)}`);
    return this;
  }

  single(): Promise<{ data: Record<string, unknown> | null; error: null }> {
    return Promise.resolve({ data: this.row, error: null });
  }

  /** Read path for the single-row-per-date tables: `null` means "no row yet". */
  maybeSingle(): Promise<
    { data: Record<string, unknown> | null; error: null }
  > {
    return Promise.resolve({ data: this.row, error: null });
  }
}

/**
 * The set-returning-function path (`search_entries`), which PostgREST lets you
 * filter and limit like a table. Unlike `FakeMutationBuilder` it resolves at
 * `.limit()` rather than `.single()`/`.maybeSingle()`, because that is the
 * terminal call the search tool awaits.
 */
class FakeRpcBuilder {
  readonly filters: string[] = [];
  limitValue: number | null = null;

  constructor(
    readonly fn: string,
    readonly args: Record<string, unknown>,
    private readonly rows: Record<string, unknown>[] | null,
    private readonly error: { message: string } | null,
  ) {}

  in(column: string, values: unknown[]): FakeRpcBuilder {
    this.filters.push(`in:${column}:${values.join(",")}`);
    return this;
  }

  limit(count: number): Promise<{
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  }> {
    this.limitValue = count;
    return Promise.resolve({ data: this.rows, error: this.error });
  }
}

class FakeSupabase {
  lastBuilder: FakeMutationBuilder | null = null;
  lastRpc: FakeRpcBuilder | null = null;
  /** Row every builder resolves to; set to `null` to simulate a missing row. */
  row: Record<string, unknown> | null = { ok: true };
  /** Rows `rpc()` resolves to; set to `null` alongside `rpcError` to fail. */
  rpcRows: Record<string, unknown>[] | null = [];
  rpcError: { message: string } | null = null;

  from(table: string): FakeMutationBuilder {
    this.lastBuilder = new FakeMutationBuilder(table, this.row);
    return this.lastBuilder;
  }

  rpc(fn: string, args: Record<string, unknown>): FakeRpcBuilder {
    this.lastRpc = new FakeRpcBuilder(fn, args, this.rpcRows, this.rpcError);
    return this.lastRpc;
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

Deno.test("repeat task schedule validation enforces valid midnight cron fields", () => {
  assertEquals(cronScheduleSchema.safeParse("0 0 * * *").success, true);
  assertEquals(cronScheduleSchema.safeParse("0 0 1,15 * 1-5").success, true);
  assertEquals(cronScheduleSchema.safeParse("0 0 */2 * 0").success, true);
  assertEquals(cronScheduleSchema.safeParse("* * * * *").success, false);
  assertEquals(cronScheduleSchema.safeParse("0 12 * * *").success, false);
  assertEquals(cronScheduleSchema.safeParse("0 0 0 * *").success, false);
  assertEquals(cronScheduleSchema.safeParse("0 0 99 * *").success, false);
  assertEquals(cronScheduleSchema.safeParse("0 0 * 99 *").success, false);
  assertEquals(cronScheduleSchema.safeParse("0 0 * * 8").success, false);
  assertEquals(cronScheduleSchema.safeParse("0 0 5-3 * *").success, false);
  assertEquals(cronScheduleSchema.safeParse("0 0 1,99 * *").success, false);
});

// DEX-65: `update_template` widens the schedule to nullable so a repeat task
// can be cleared back into a plain task template. The bare schema must still
// reject null, or an invalid cron could slip past as one.
Deno.test("a nullable schedule accepts null without loosening cron validation", () => {
  assertEquals(cronScheduleSchema.nullable().safeParse(null).success, true);
  assertEquals(cronScheduleSchema.safeParse(null).success, false);
  assertEquals(
    cronScheduleSchema.nullable().safeParse("0 12 * * *").success,
    false,
  );
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

// A richer fake than FakeSupabase: it hands out per-table queued rows for
// `.single()`/`.maybeSingle()` reads and records inserts/deletes, so the
// multi-step recurrence and delete-cleanup flows can be asserted end to end.
type FakeRow = Record<string, unknown>;

class RecordingBuilder {
  op: "select" | "insert" | "update" | "delete" = "select";
  filters: string[] = [];
  payload: FakeRow | null = null;

  constructor(private fake: RecordingSupabase, readonly table: string) {}

  select(): RecordingBuilder {
    return this;
  }

  insert(payload: FakeRow): RecordingBuilder {
    this.op = "insert";
    this.payload = payload;
    this.fake.inserts.push({ table: this.table, payload });
    return this;
  }

  update(payload: FakeRow): RecordingBuilder {
    this.op = "update";
    this.payload = payload;
    this.fake.updates.push({ table: this.table, payload });
    return this;
  }

  delete(): RecordingBuilder {
    this.op = "delete";
    return this;
  }

  eq(column: string, value: unknown): RecordingBuilder {
    this.filters.push(`eq:${column}:${String(value)}`);
    return this;
  }

  in(column: string, values: unknown[]): RecordingBuilder {
    this.filters.push(`in:${column}:${values.join(",")}`);
    return this;
  }

  limit(count: number): RecordingBuilder {
    this.filters.push(`limit:${count}`);
    return this;
  }

  maybeSingle(): Promise<{ data: FakeRow | null; error: null }> {
    return Promise.resolve({ data: this.fake.take(this.table), error: null });
  }

  single(): Promise<{ data: FakeRow; error: null }> {
    return Promise.resolve({
      data: this.fake.take(this.table) ?? {},
      error: null,
    });
  }

  // Thenable so awaiting a chain directly (no `.single()`) resolves like
  // PostgREST: a row array for a select, and a recorded delete otherwise.
  then<T>(
    onFulfilled: (value: { data: FakeRow[] | null; error: null }) => T,
  ): Promise<T> {
    if (this.op === "delete") {
      this.fake.deletes.push({ table: this.table, filters: this.filters });
      return Promise.resolve({ data: null, error: null }).then(onFulfilled);
    }
    return Promise.resolve({ data: this.fake.rowsFor(this.table), error: null })
      .then(onFulfilled);
  }
}

class RecordingSupabase {
  inserts: { table: string; payload: FakeRow }[] = [];
  updates: { table: string; payload: FakeRow }[] = [];
  deletes: { table: string; filters: string[] }[] = [];

  constructor(
    private queues: Record<string, FakeRow[]>,
    /**
     * Rows a *list* select returns — one awaited without `.single()`, like the
     * one-open-task guard. Fixed rather than queued, since each flow runs at
     * most one; empty by default, which reads as "no other open task".
     */
    private lists: Record<string, FakeRow[]> = {},
  ) {}

  take(table: string): FakeRow | null {
    return this.queues[table]?.shift() ?? null;
  }

  rowsFor(table: string): FakeRow[] {
    return this.lists[table] ?? [];
  }

  from(table: string): RecordingBuilder {
    return new RecordingBuilder(this, table);
  }
}

function recordingContext(
  fake: RecordingSupabase,
  userId: string,
): ToolContext {
  return {
    supabase: fake as unknown as ToolContext["supabase"],
    userId,
  };
}

const RECUR_USER = "00000000-0000-4000-8000-0000000000aa";
const RECUR_TASK = "00000000-0000-4000-8000-0000000000cc";
const RECUR_TEMPLATE = "00000000-0000-4000-8000-0000000000dd";

Deno.test("update_task schedules the next occurrence when it completes a repeat task", async () => {
  const registry = new ToolRegistry();
  const supabase = new RecordingSupabase({
    // Pre-update status read, then the updated row returned by the update.
    tasks: [
      { status: 1 },
      {
        status: 2,
        template_id: RECUR_TEMPLATE,
        scheduled_for: "2030-01-01",
      },
    ],
    repeat_task_templates: [
      {
        id: RECUR_TEMPLATE,
        title: "Water the plants",
        priority: 2,
        list_id: null,
        goal_id: null,
        schedule: "0 0 * * *",
      },
    ],
  });

  registerTaskTools(
    registry as unknown as McpServer,
    recordingContext(supabase, RECUR_USER),
  );

  await registry.run("update_task", { taskId: RECUR_TASK, status: 2 });

  const inserted = supabase.inserts.find((i) => i.table === "tasks");
  assert(inserted, "expected a next occurrence to be inserted");
  // Daily, anchored to the (future) scheduled date, so max(today, date) is the date.
  assertEquals(inserted.payload.scheduled_for, "2030-01-02");
  assertEquals(inserted.payload.template_id, RECUR_TEMPLATE);
  assertEquals(inserted.payload.title, "Water the plants");
  assertEquals(inserted.payload.status, 1);
  assertEquals(inserted.payload.user_id, RECUR_USER);
});

// A repeat has exactly one open task. Converting a template to a repeat makes
// every task stamped from it an occurrence retroactively, so completing three
// of them must not start three parallel chains. The completing task is already
// terminal by the time this runs, so it can't match its own guard.
Deno.test("update_task spawns nothing when another open task links to the template", async () => {
  const registry = new ToolRegistry();
  const supabase = new RecordingSupabase({
    tasks: [
      { status: 1 },
      { status: 2, template_id: RECUR_TEMPLATE, scheduled_for: "2030-01-01" },
    ],
    repeat_task_templates: [
      {
        id: RECUR_TEMPLATE,
        title: "Water the plants",
        priority: 2,
        list_id: null,
        goal_id: null,
        schedule: "0 0 * * *",
      },
    ],
  }, {
    // A sibling task stamped from the same template, still open.
    tasks: [{ id: "00000000-0000-4000-8000-0000000000ee" }],
  });

  registerTaskTools(
    registry as unknown as McpServer,
    recordingContext(supabase, RECUR_USER),
  );

  await registry.run("update_task", { taskId: RECUR_TASK, status: 2 });

  assertEquals(
    supabase.inserts.filter((i) => i.table === "tasks").length,
    0,
  );
});

// The whole point of DEX-65: a template is a blueprint, so completing a task
// linked to one must not spawn anything. `maybeCreateNextRecurringTask` bails
// on a falsy schedule, which is what keeps a converted repeat from recurring.
Deno.test("update_task spawns nothing when the linked template has no schedule", async () => {
  const registry = new ToolRegistry();
  const supabase = new RecordingSupabase({
    tasks: [
      { status: 1 },
      { status: 2, template_id: RECUR_TEMPLATE, scheduled_for: "2030-01-01" },
    ],
    repeat_task_templates: [
      {
        id: RECUR_TEMPLATE,
        title: "Trip packing",
        priority: 2,
        list_id: null,
        goal_id: null,
        schedule: null,
      },
    ],
  });

  registerTaskTools(
    registry as unknown as McpServer,
    recordingContext(supabase, RECUR_USER),
  );

  await registry.run("update_task", { taskId: RECUR_TASK, status: 2 });

  assertEquals(supabase.inserts.filter((i) => i.table === "tasks").length, 0);
});

Deno.test("update_task does not re-create an occurrence for an already-complete task", async () => {
  const registry = new ToolRegistry();
  const supabase = new RecordingSupabase({
    // Already won't-do before this update — not a fresh completion.
    tasks: [
      { status: 3 },
      { status: 2, template_id: RECUR_TEMPLATE, scheduled_for: "2030-01-01" },
    ],
    repeat_task_templates: [
      { id: RECUR_TEMPLATE, schedule: "0 0 * * *", title: "x", priority: 4 },
    ],
  });

  registerTaskTools(
    registry as unknown as McpServer,
    recordingContext(supabase, RECUR_USER),
  );

  await registry.run("update_task", { taskId: RECUR_TASK, status: 2 });

  assertEquals(
    supabase.inserts.filter((i) => i.table === "tasks").length,
    0,
  );
});

Deno.test("update_task does not spawn an occurrence when editing a completed repeat task's non-status fields", async () => {
  const registry = new ToolRegistry();
  const supabase = new RecordingSupabase({
    // The update carries no status, so only the updated (still-done) row is
    // read — the recurrence path must not fire for a plain edit.
    tasks: [
      { status: 2, template_id: RECUR_TEMPLATE, scheduled_for: "2030-01-01" },
    ],
    repeat_task_templates: [
      { id: RECUR_TEMPLATE, schedule: "0 0 * * *", title: "x", priority: 4 },
    ],
  });

  registerTaskTools(
    registry as unknown as McpServer,
    recordingContext(supabase, RECUR_USER),
  );

  await registry.run("update_task", { taskId: RECUR_TASK, priority: 4 });

  assertEquals(
    supabase.inserts.filter((i) => i.table === "tasks").length,
    0,
  );
});

Deno.test("archive_task schedules the next occurrence when it completes a repeat task", async () => {
  const registry = new ToolRegistry();
  const supabase = new RecordingSupabase({
    tasks: [
      { status: 1 },
      { status: 3, template_id: RECUR_TEMPLATE, scheduled_for: "2030-01-01" },
    ],
    repeat_task_templates: [
      { id: RECUR_TEMPLATE, schedule: "0 0 * * *", title: "y", priority: 4 },
    ],
  });

  registerTaskTools(
    registry as unknown as McpServer,
    recordingContext(supabase, RECUR_USER),
  );

  await registry.run("archive_task", { taskId: RECUR_TASK });

  assertEquals(
    supabase.inserts.filter((i) => i.table === "tasks").length,
    1,
  );
});

Deno.test("delete_task also deletes a linked repeat template", async () => {
  const registry = new ToolRegistry();
  const supabase = new RecordingSupabase({
    tasks: [{ template_id: RECUR_TEMPLATE }],
    // Read back to check the link is a repeat schedule and not a saved template.
    repeat_task_templates: [{ schedule: "0 0 * * *" }],
  });

  registerTaskTools(
    registry as unknown as McpServer,
    recordingContext(supabase, RECUR_USER),
  );

  await registry.run("delete_task", { taskId: RECUR_TASK });

  assert(supabase.deletes.some((d) => d.table === "tasks"));
  const templateDelete = supabase.deletes.find(
    (d) => d.table === "repeat_task_templates",
  );
  assert(templateDelete, "expected the linked template to be deleted");
  assertEquals(templateDelete.filters, [
    `eq:id:${RECUR_TEMPLATE}`,
    `eq:user_id:${RECUR_USER}`,
  ]);
});

// A linked template with no schedule is a saved task template (DEX-65) — the
// user's, not this task's. Deleting the task must not take it down too.
Deno.test("delete_task keeps a linked task template", async () => {
  const registry = new ToolRegistry();
  const supabase = new RecordingSupabase({
    tasks: [{ template_id: RECUR_TEMPLATE }],
    repeat_task_templates: [{ schedule: null }],
  });

  registerTaskTools(
    registry as unknown as McpServer,
    recordingContext(supabase, RECUR_USER),
  );

  await registry.run("delete_task", { taskId: RECUR_TASK });

  assert(supabase.deletes.some((d) => d.table === "tasks"));
  assertEquals(
    supabase.deletes.filter((d) => d.table === "repeat_task_templates").length,
    0,
  );
});

Deno.test("delete_task leaves standalone tasks' templates untouched", async () => {
  const registry = new ToolRegistry();
  const supabase = new RecordingSupabase({
    tasks: [{ template_id: null }],
  });

  registerTaskTools(
    registry as unknown as McpServer,
    recordingContext(supabase, RECUR_USER),
  );

  await registry.run("delete_task", { taskId: RECUR_TASK });

  assertEquals(
    supabase.deletes.filter((d) => d.table === "repeat_task_templates").length,
    0,
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

// DEX-70: subtasks ride on the parent row as a jsonb array.

const SUB_USER = "00000000-0000-4000-8000-0000000000ee";
const SUB_TASK = "00000000-0000-4000-8000-0000000000ff";

function taskTools(supabase: RecordingSupabase, userId = SUB_USER) {
  const registry = new ToolRegistry();
  registerTaskTools(
    registry as unknown as McpServer,
    recordingContext(supabase, userId),
  );
  return registry;
}

Deno.test("create_task stores the provided checklist", async () => {
  const supabase = new RecordingSupabase({ tasks: [{ ok: true }] });
  const subtasks = [
    { id: "s1", title: "Pack bag", status: 1 },
    { id: "s2", title: "Fill bottle", status: 2 },
  ];

  await taskTools(supabase).run("create_task", {
    title: "Get ready",
    subtasks,
  });

  assertEquals(supabase.inserts[0].payload.subtasks, subtasks);
});

Deno.test("create_task defaults the checklist to an empty array", async () => {
  const supabase = new RecordingSupabase({ tasks: [{ ok: true }] });

  await taskTools(supabase).run("create_task", { title: "Get ready" });

  // Never null: every read path treats subtasks as an array without guarding.
  assertEquals(supabase.inserts[0].payload.subtasks, []);
});

Deno.test("update_task replaces the whole checklist array", async () => {
  const supabase = new RecordingSupabase({ tasks: [{ ok: true }] });
  const replacement = [{ id: "s1", title: "Only this one", status: 1 }];

  await taskTools(supabase).run("update_task", {
    taskId: SUB_TASK,
    subtasks: replacement,
  });

  assertEquals(supabase.updates[0].payload.subtasks, replacement);
});

Deno.test("update_task rejects malformed subtask entries", () => {
  const registry = taskTools(new RecordingSupabase({}));
  const schema = registry.tools.get("update_task")
    ?.inputSchema as Record<
      string,
      { safeParse(v: unknown): { success: boolean } }
    >;

  assertEquals(
    schema.subtasks.safeParse([{ id: "s1", title: "Ok", status: 1 }]).success,
    true,
  );
  // A subtask is exactly {id, title, status}; anything else is a client bug and
  // must not reach the column, since nothing downstream re-validates it.
  assertEquals(
    schema.subtasks.safeParse([{ id: "s1", title: "" }]).success,
    false,
  );
  assertEquals(
    schema.subtasks.safeParse([{ title: "No id", status: 1 }]).success,
    false,
  );
  assertEquals(
    schema.subtasks.safeParse([{ id: "s1", title: "Bad status", status: 9 }])
      .success,
    false,
  );
  // 4 is delegated (DEX-68). The bound gates stored rows as well as tool input,
  // and a subtask that fails to parse silently loses its parent's sweep.
  assertEquals(
    schema.subtasks.safeParse([{ id: "s1", title: "Delegated", status: 4 }])
      .success,
    true,
  );
  assertEquals(
    schema.subtasks.safeParse([{ id: "s1", title: "Past the end", status: 5 }])
      .success,
    false,
  );
  // The bound is `z.nativeEnum(ETaskStatus)`, and a numeric TS enum carries a
  // reverse mapping — assert the key names are not silently accepted as values,
  // which would put a string into a smallint column.
  assertEquals(
    schema.subtasks.safeParse([{ id: "s1", title: "By name", status: "DONE" }])
      .success,
    false,
  );
  assertEquals(schema.subtasks.safeParse("not an array").success, false);
});

Deno.test("update_task sweeps open subtasks closed in the same write", async () => {
  const supabase = new RecordingSupabase({
    tasks: [
      // Pre-update read: status plus the checklist to sweep.
      {
        status: 1,
        subtasks: [
          { id: "s1", title: "Open", status: 1 },
          { id: "s2", title: "Already done", status: 2 },
        ],
      },
      { status: 2, template_id: null, scheduled_for: null },
    ],
  });

  await taskTools(supabase).run("update_task", { taskId: SUB_TASK, status: 2 });

  // One write carries both — that is what makes the sweep atomic.
  assertEquals(supabase.updates.length, 1);
  assertEquals(supabase.updates[0].payload.status, 2);
  assertEquals(supabase.updates[0].payload.subtasks, [
    { id: "s1", title: "Open", status: 2 },
    { id: "s2", title: "Already done", status: 2 },
  ]);
});

Deno.test("update_task sweeps the checklist for delegated too, not just done", async () => {
  const supabase = new RecordingSupabase({
    tasks: [
      {
        status: 1,
        subtasks: [
          { id: "s1", title: "Open", status: 1 },
          { id: "s2", title: "Started", status: 0 },
        ],
      },
      { status: 4, template_id: null, scheduled_for: null },
    ],
  });

  // Delegated (4) is terminal alongside done (2) and won't-do (3) — handing the
  // parent off closes its checklist the same way (DEX-68).
  await taskTools(supabase).run("update_task", { taskId: SUB_TASK, status: 4 });

  assertEquals(supabase.updates.length, 1);
  assertEquals(supabase.updates[0].payload.subtasks, [
    { id: "s1", title: "Open", status: 4 },
    { id: "s2", title: "Started", status: 4 },
  ]);
});

Deno.test("update_task lets an explicit checklist win over the sweep", async () => {
  const explicit = [{ id: "s1", title: "Renamed", status: 1 }];
  const supabase = new RecordingSupabase({
    tasks: [
      { status: 1, subtasks: [{ id: "s1", title: "Open", status: 1 }] },
      { status: 2, template_id: null, scheduled_for: null },
    ],
  });

  await taskTools(supabase).run("update_task", {
    taskId: SUB_TASK,
    status: 2,
    subtasks: explicit,
  });

  assertEquals(supabase.updates[0].payload.subtasks, explicit);
});

Deno.test("update_task does not touch the checklist on a non-completing update", async () => {
  const supabase = new RecordingSupabase({ tasks: [{ ok: true }] });

  await taskTools(supabase).run("update_task", {
    taskId: SUB_TASK,
    priority: 2,
  });

  assertEquals("subtasks" in supabase.updates[0].payload, false);
});

Deno.test("archive_task sweeps the checklist, and restoring leaves it alone", async () => {
  const archiving = new RecordingSupabase({
    tasks: [
      { status: 1, subtasks: [{ id: "s1", title: "Open", status: 1 }] },
      { status: 3, template_id: null, scheduled_for: null },
    ],
  });

  await taskTools(archiving).run("archive_task", { taskId: SUB_TASK });

  assertEquals(archiving.updates[0].payload.subtasks, [
    { id: "s1", title: "Open", status: 3 },
  ]);

  const restoring = new RecordingSupabase({
    tasks: [{ status: 1, template_id: null, scheduled_for: null }],
  });

  await taskTools(restoring).run("archive_task", {
    taskId: SUB_TASK,
    restore: true,
  });

  // A restored task returns to todo with its checklist as the user left it.
  assertEquals("subtasks" in restoring.updates[0].payload, false);
});

Deno.test("a recurring occurrence gets a fresh copy of the template's checklist", async () => {
  const supabase = new RecordingSupabase({
    tasks: [
      { status: 1, subtasks: [{ id: "old", title: "Water", status: 1 }] },
      { status: 2, template_id: RECUR_TEMPLATE, scheduled_for: "2030-01-01" },
    ],
    repeat_task_templates: [
      {
        id: RECUR_TEMPLATE,
        title: "Water the plants",
        priority: 2,
        list_id: null,
        goal_id: null,
        schedule: "0 0 * * *",
        subtasks: [
          { id: "tpl-1", title: "Water" },
          { id: "tpl-2", title: "Prune" },
        ],
      },
    ],
  });

  await taskTools(supabase).run("update_task", { taskId: SUB_TASK, status: 2 });

  const inserted = supabase.inserts.find((i) => i.table === "tasks");
  assert(inserted, "expected a next occurrence to be inserted");
  const subtasks = inserted.payload.subtasks as {
    id: string;
    title: string;
    status: number;
  }[];

  assertEquals(subtasks.map((s) => s.title), ["Water", "Prune"]);
  // Reset to open, and sharing ids with neither the template nor the task that
  // just completed — each occurrence's checklist is independent state.
  assertEquals(subtasks.every((s) => s.status === 1), true);
  assertEquals(subtasks.some((s) => s.id === "tpl-1" || s.id === "old"), false);
});

Deno.test("the sweep survives a stored title longer than the input cap", async () => {
  // The app has its own maxLength, but a title stored before that existed (or
  // written any other way) must not make the whole array unparseable — failing
  // the read would silently skip the sweep rather than reject anything.
  const longTitle = "x".repeat(250);
  const supabase = new RecordingSupabase({
    tasks: [
      { status: 1, subtasks: [{ id: "s1", title: longTitle, status: 1 }] },
      { status: 2, template_id: null, scheduled_for: null },
    ],
  });

  await taskTools(supabase).run("update_task", { taskId: SUB_TASK, status: 2 });

  assertEquals(supabase.updates[0].payload.subtasks, [
    { id: "s1", title: longTitle, status: 2 },
  ]);
});

Deno.test("create_task sweeps a checklist when the task is created complete", async () => {
  const supabase = new RecordingSupabase({ tasks: [{ ok: true }] });

  await taskTools(supabase).run("create_task", {
    title: "Already handled",
    status: 2,
    subtasks: [
      { id: "s1", title: "Open", status: 1 },
      { id: "s2", title: "Also open", status: 0 },
    ],
  });

  // Otherwise a done parent with open children could be inserted directly,
  // sidestepping the invariant update_task and archive_task both enforce.
  assertEquals(supabase.inserts[0].payload.subtasks, [
    { id: "s1", title: "Open", status: 2 },
    { id: "s2", title: "Also open", status: 2 },
  ]);
});

Deno.test("create_task leaves the checklist alone for an incomplete task", async () => {
  const supabase = new RecordingSupabase({ tasks: [{ ok: true }] });
  const subtasks = [{ id: "s1", title: "Open", status: 1 }];

  await taskTools(supabase).run("create_task", {
    title: "In flight",
    status: 1,
    subtasks,
  });

  assertEquals(supabase.inserts[0].payload.subtasks, subtasks);
});

Deno.test("a recurring occurrence copies a template checklist past the input cap", async () => {
  const longTitle = "y".repeat(250);
  const supabase = new RecordingSupabase({
    tasks: [
      { status: 1, subtasks: [] },
      { status: 2, template_id: RECUR_TEMPLATE, scheduled_for: "2030-01-01" },
    ],
    repeat_task_templates: [
      {
        id: RECUR_TEMPLATE,
        title: "Water the plants",
        priority: 2,
        list_id: null,
        goal_id: null,
        schedule: "0 0 * * *",
        subtasks: [{ id: "tpl-1", title: longTitle }],
      },
    ],
  });

  await taskTools(supabase).run("update_task", { taskId: SUB_TASK, status: 2 });

  const inserted = supabase.inserts.find((i) => i.table === "tasks");
  assert(inserted, "expected a next occurrence to be inserted");
  assertEquals(
    (inserted.payload.subtasks as { title: string }[]).map((s) => s.title),
    [longTitle],
  );
});

// DEX-51: notes and journals replaced the shared `days` row, so each surface now
// has its own read/write pair against its own table.

const NOTE_USER = "00000000-0000-4000-8000-0000000000cc";

function noteTools(supabase: FakeSupabase): ToolRegistry {
  const registry = new ToolRegistry();
  registerNoteTools(
    registry as unknown as McpServer,
    makeToolContext(supabase, NOTE_USER),
  );
  return registry;
}

function journalTools(supabase: FakeSupabase): ToolRegistry {
  const registry = new ToolRegistry();
  registerJournalTools(
    registry as unknown as McpServer,
    makeToolContext(supabase, NOTE_USER),
  );
  return registry;
}

Deno.test("get_note reads the notes table scoped to the caller and date", async () => {
  const supabase = new FakeSupabase();
  supabase.row = { date: "2026-07-12", content: "hello" };

  await noteTools(supabase).run("get_note", { date: "2026-07-12" });

  assertEquals(supabase.lastBuilder?.table, "notes");
  // RLS is the enforcement layer, but the explicit user filter keeps a
  // cross-user row from ever being requested.
  assertEquals(supabase.lastBuilder?.filters, [
    "eq:date:2026-07-12",
    `eq:user_id:${NOTE_USER}`,
  ]);
});

Deno.test("get_note returns a blank note for a date with no row, not an error", async () => {
  const supabase = new FakeSupabase();
  supabase.row = null;

  const result = await noteTools(supabase).run("get_note", {
    date: "2026-07-12",
  }) as { isError?: boolean; content: Array<{ text: string }> };

  // An unwritten day is ordinary, not a failure: `toolError` also reports to
  // Sentry, so erroring here would page us for every empty day an agent reads.
  assertEquals(result.isError, undefined);
  assertEquals(JSON.parse(result.content[0].text), {
    date: "2026-07-12",
    content: "",
    user_id: NOTE_USER,
  });
});

Deno.test("get_journal returns an empty prompt array for a date with no row", async () => {
  const supabase = new FakeSupabase();
  supabase.row = null;

  const result = await journalTools(supabase).run("get_journal", {
    date: "2026-07-12",
  }) as { isError?: boolean; content: Array<{ text: string }> };

  assertEquals(result.isError, undefined);
  assertEquals(JSON.parse(result.content[0].text), {
    date: "2026-07-12",
    prompts: [],
    user_id: NOTE_USER,
  });
});

Deno.test("upsert_journal accepts any prompt set the app can legitimately store", () => {
  const registry = journalTools(new FakeSupabase());
  const prompts = registry.tools.get("upsert_journal")!.inputSchema!
    .prompts as {
      safeParse: (value: unknown) => { success: boolean };
    };
  const entries = (count: number, prompt = "Highlight") =>
    Array.from({ length: count }, () => ({ prompt, response: "" }));

  // Nothing caps prompt count or length in the settings editor, in
  // `update_preferences`, or on `preferences.template_prompts`, and `useJournals`
  // seeds a row from that template through PostgREST (no Zod). A cap here would
  // reject a row the app itself wrote, permanently breaking the documented
  // get_journal → upsert_journal round trip for that user.
  assertEquals(prompts.safeParse(entries(60)).success, true);
  assertEquals(prompts.safeParse(entries(1, "x".repeat(250))).success, true);
  // Shape is still enforced — the column's check constraint expects an array of
  // {prompt, response}.
  assertEquals(prompts.safeParse([{ prompt: "Highlight" }]).success, false);
  assertEquals(prompts.safeParse("not an array").success, false);
});

Deno.test("upsert_note derives user_id from context and targets (user_id, date)", async () => {
  const supabase = new FakeSupabase();

  await noteTools(supabase).run("upsert_note", {
    date: "2026-07-12",
    content: "# Today",
  });

  assertEquals(supabase.lastBuilder?.table, "notes");
  assertEquals(supabase.lastBuilder?.payload, {
    date: "2026-07-12",
    user_id: NOTE_USER,
    content: "# Today",
  });
  // `user_id` is part of the key, so the conflict target must name it.
  assertEquals(supabase.lastBuilder?.upsertOptions, {
    onConflict: "user_id,date",
  });
});

Deno.test("upsert_note rejects a call that carries no fields", async () => {
  const supabase = new FakeSupabase();

  const result = await noteTools(supabase).run("upsert_note", {
    date: "2026-07-12",
  }) as { isError?: boolean };

  // A date alone would otherwise insert a blank row, which the app reads as
  // "the user started this day" (the template chooser depends on it).
  assertEquals(result.isError, true);
  assertEquals(supabase.lastBuilder, null);
});

Deno.test("get_journal reads the journals table scoped to the caller and date", async () => {
  const supabase = new FakeSupabase();
  supabase.row = { date: "2026-07-12", prompts: [] };

  await journalTools(supabase).run("get_journal", { date: "2026-07-12" });

  assertEquals(supabase.lastBuilder?.table, "journals");
  assertEquals(supabase.lastBuilder?.filters, [
    "eq:date:2026-07-12",
    `eq:user_id:${NOTE_USER}`,
  ]);
});

Deno.test("upsert_journal replaces the prompt array on the (user_id, date) key", async () => {
  const supabase = new FakeSupabase();
  const prompts = [{ prompt: "Highlight", response: "shipped it" }];

  await journalTools(supabase).run("upsert_journal", {
    date: "2026-07-12",
    prompts,
  });

  assertEquals(supabase.lastBuilder?.table, "journals");
  assertEquals(supabase.lastBuilder?.payload, {
    date: "2026-07-12",
    user_id: NOTE_USER,
    prompts,
  });
  assertEquals(supabase.lastBuilder?.upsertOptions, {
    onConflict: "user_id,date",
  });
});

Deno.test("upsert_journal rejects a call that carries no fields", async () => {
  const supabase = new FakeSupabase();

  const result = await journalTools(supabase).run("upsert_journal", {
    date: "2026-07-12",
  }) as { isError?: boolean };

  assertEquals(result.isError, true);
  assertEquals(supabase.lastBuilder, null);
});

Deno.test("note, journal, and search tools never accept a user id", () => {
  const registries = [
    noteTools(new FakeSupabase()),
    journalTools(new FakeSupabase()),
    searchTools(new FakeSupabase()),
  ];

  for (const registry of registries) {
    for (const [name, tool] of registry.tools) {
      const keys = Object.keys(tool.inputSchema ?? {});
      assertEquals(keys.includes("userId"), false, `${name} exposes userId`);
      assertEquals(keys.includes("user_id"), false, `${name} exposes user_id`);
    }
  }
});

// DEX-47: search. The handler is thin by design — the matching lives in the
// `search_entries` RPC (see supabase/__tests__/migrations/search_entries.test.ts)
// — so these pin the call it makes and the two paths where a thin handler still
// gets it wrong: reporting "no results" as an error, and dropping the caller's
// filters.

function searchTools(supabase: FakeSupabase): ToolRegistry {
  const registry = new ToolRegistry();
  registerSearchTools(
    registry as unknown as McpServer,
    makeToolContext(supabase, NOTE_USER),
  );
  return registry;
}

Deno.test("search passes the raw query to the RPC and caps the result count", async () => {
  const supabase = new FakeSupabase();

  await searchTools(supabase).run(
    "search",
    searchSchema.parse({ query: "buy milk" }),
  );

  assertEquals(supabase.lastRpc?.fn, "search_entries");
  // Unparsed and unescaped: term splitting and LIKE escaping are the RPC's job,
  // so doing either here would double-escape the user's query.
  assertEquals(supabase.lastRpc?.args, { query: "buy milk" });
  assertEquals(supabase.lastRpc?.limitValue, 50);
  assertEquals(supabase.lastRpc?.filters, []);
});

Deno.test("search never scopes by user id, leaving that to RLS", async () => {
  const supabase = new FakeSupabase();

  await searchTools(supabase).run(
    "search",
    searchSchema.parse({ query: "quarterly" }),
  );

  // `search_entries` is SECURITY INVOKER, so it runs under the caller's JWT and
  // RLS scopes every branch. An `eq:user_id:` filter here would be a sign the
  // function had been switched to SECURITY DEFINER without the tool catching up.
  assertEquals(
    supabase.lastRpc?.filters.some((filter) => filter.startsWith("eq:user_id")),
    false,
  );
  assertEquals(supabase.lastBuilder, null);
});

Deno.test("search narrows to the requested kinds", async () => {
  const supabase = new FakeSupabase();

  await searchTools(supabase).run(
    "search",
    searchSchema.parse({
      query: "retro",
      kinds: ["note", "journal"],
      limit: 5,
    }),
  );

  assertEquals(supabase.lastRpc?.filters, ["in:kind:note,journal"]);
  assertEquals(supabase.lastRpc?.limitValue, 5);
});

Deno.test("search rejects an empty query and an out-of-range limit", () => {
  assertEquals(searchSchema.safeParse({ query: "" }).success, false);
  assertEquals(searchSchema.safeParse({ query: "x", limit: 0 }).success, false);
  assertEquals(
    searchSchema.safeParse({ query: "x", limit: 201 }).success,
    false,
  );
  assertEquals(
    searchSchema.safeParse({ query: "x", kinds: ["habit"] }).success,
    false,
  );
});

Deno.test("search treats no results as an ordinary answer, not an error", async () => {
  const supabase = new FakeSupabase();
  // PostgREST returns null data for a set-returning function with no rows.
  supabase.rpcRows = null;

  const result = await searchTools(supabase).run(
    "search",
    searchSchema.parse({ query: "nothing matches this" }),
  ) as { isError?: boolean; content: { text: string }[] };

  // `toolError` reports to Sentry, so returning one here would page us every
  // time an agent searched for something the user hasn't written about.
  assertEquals(result.isError, undefined);
  assertEquals(result.content[0].text, "[]");
});

Deno.test("search reports an RPC failure as a tool error", async () => {
  const supabase = new FakeSupabase();
  supabase.rpcRows = null;
  supabase.rpcError = { message: "function search_entries does not exist" };

  const result = await searchTools(supabase).run(
    "search",
    searchSchema.parse({ query: "anything" }),
  ) as { isError?: boolean; content: { text: string }[] };

  assertEquals(result.isError, true);
  assertEquals(
    result.content[0].text,
    "function search_entries does not exist",
  );
});
