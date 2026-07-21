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

  maybeSingle(): Promise<{ data: FakeRow | null; error: null }> {
    return Promise.resolve({ data: this.fake.take(this.table), error: null });
  }

  single(): Promise<{ data: FakeRow; error: null }> {
    return Promise.resolve({
      data: this.fake.take(this.table) ?? {},
      error: null,
    });
  }

  // Thenable so awaiting an insert/delete chain directly (no `.single()`)
  // resolves like PostgREST and lets us record the delete.
  then<T>(
    onFulfilled: (value: { data: null; error: null }) => T,
  ): Promise<T> {
    if (this.op === "delete") {
      this.fake.deletes.push({ table: this.table, filters: this.filters });
    }
    return Promise.resolve({ data: null, error: null }).then(onFulfilled);
  }
}

class RecordingSupabase {
  inserts: { table: string; payload: FakeRow }[] = [];
  updates: { table: string; payload: FakeRow }[] = [];
  deletes: { table: string; filters: string[] }[] = [];

  constructor(private queues: Record<string, FakeRow[]>) {}

  take(table: string): FakeRow | null {
    return this.queues[table]?.shift() ?? null;
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
