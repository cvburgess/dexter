import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getNextTaskDate } from "@src/utils/repeatSchedule.ts";
import { subtasksFromTemplate, sweepSubtasks } from "@src/utils/subtasks.ts";

import type { ToolContext } from "../server.ts";
import {
  compactUpdate,
  dateSchema,
  getTodayIsoDate,
  hasUpdates,
  subtaskSchema,
  subtasksSchema,
  taskPrioritySchema,
  taskStatusSchema,
  templateSubtaskSchema,
  toolError,
  toolJson,
  uuidSchema,
} from "./helpers.ts";

const TASK_STATUS_TODO = 1;
const TASK_STATUS_DONE = 2;
const TASK_STATUS_WONT_DO = 3;

const isCompletionStatus = (status: number | null | undefined): boolean =>
  status === TASK_STATUS_DONE || status === TASK_STATUS_WONT_DO;

type Subtask = z.infer<typeof subtaskSchema>;

/**
 * Reads a task row's `subtasks` column, which Postgres types as `Json`. A
 * payload that doesn't match the shape is treated as empty rather than trusted —
 * the column is writable by any MCP client, and a malformed entry must not
 * corrupt a sweep.
 */
const readSubtasks = (value: unknown): Subtask[] => {
  const parsed = subtasksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

/**
 * Reads the row a completing write is about to overwrite, returning both the
 * pre-update status (so recurrence can tell a fresh completion from a re-tap)
 * and the checklist swept to `status`. Shared by `update_task` and
 * `archive_task` — the two completion paths — so the read and the sweep can't
 * drift apart between them. Piggybacks on the read recurrence already needed:
 * no extra round trip.
 */
async function readForCompletion(
  ctx: ToolContext,
  taskId: string,
  status: number,
): Promise<{ previousStatus?: number; sweptSubtasks?: Subtask[] }> {
  const { data: existing } = await ctx.supabase
    .from("tasks")
    .select("status, subtasks")
    .eq("id", taskId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  const current = readSubtasks(existing?.subtasks);

  return {
    previousStatus: existing?.status,
    sweptSubtasks: current.length > 0
      ? sweepSubtasks(current, status)
      : undefined,
  };
}

/**
 * When a task update completes a repeat task, schedule its next occurrence — the
 * TypeScript replacement for the dropped `create_next_recurring_task` trigger
 * (DEX-21), sharing `getNextTaskDate` with the Expo app. No-ops unless the task
 * just transitioned into done/won't-do (from a non-complete `previousStatus`)
 * and is linked to a template with a schedule.
 */
async function maybeCreateNextRecurringTask(
  ctx: ToolContext,
  task: {
    status: number;
    template_id: string | null;
    scheduled_for: string | null;
  },
  previousStatus: number | null | undefined,
): Promise<void> {
  if (!isCompletionStatus(task.status) || isCompletionStatus(previousStatus)) {
    return;
  }
  if (!task.template_id) return;

  const { data: template } = await ctx.supabase
    .from("repeat_task_templates")
    .select("*")
    .eq("id", task.template_id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!template?.schedule) return;

  const nextDate = getNextTaskDate(
    { scheduledFor: task.scheduled_for },
    template.schedule,
    getTodayIsoDate(),
  );
  if (!nextDate) return;

  await ctx.supabase.from("tasks").insert({
    user_id: ctx.userId,
    title: template.title,
    alarm_time: template.alarm_time,
    priority: template.priority,
    list_id: template.list_id,
    goal_id: template.goal_id,
    scheduled_for: nextDate,
    template_id: template.id,
    status: TASK_STATUS_TODO,
    // Each occurrence gets its own copy of the template's checklist, reset to
    // open. Array items carry no template link, so no orphan-spawn hazard.
    subtasks: subtasksFromTemplate(
      readTemplateSubtasks(template.subtasks),
      TASK_STATUS_TODO,
    ),
  });
}

/** Template checklist items carry no status — a template is a blueprint, not state. */
const readTemplateSubtasks = (value: unknown): { title: string }[] => {
  const parsed = z.array(templateSubtaskSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
};

const statusFilterSchema = z.union([
  taskStatusSchema,
  z.array(taskStatusSchema).min(1),
]);
const priorityFilterSchema = z.union([
  taskPrioritySchema,
  z.array(taskPrioritySchema).min(1),
]);

export const listTasksInputSchema = {
  today: z.boolean().optional().default(false),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
  dateField: z.enum(["scheduled_for", "due_on"]).optional().default(
    "scheduled_for",
  ),
  status: statusFilterSchema.optional(),
  listId: uuidSchema.nullable().optional(),
  goalId: uuidSchema.nullable().optional(),
  priority: priorityFilterSchema.optional(),
  scheduledFor: dateSchema.nullable().optional(),
  dueOn: dateSchema.nullable().optional(),
};

export const listTasksSchema = z.object(listTasksInputSchema);
export type ListTasksInput = z.infer<typeof listTasksSchema>;

type TaskFilterQuery<T> = {
  eq(column: string, value: unknown): T;
  gte(column: string, value: unknown): T;
  in(column: string, values: unknown[]): T;
  is(column: string, value: null): T;
  lte(column: string, value: unknown): T;
  or(filters: string): T;
};

export function applyTaskFilters<T extends TaskFilterQuery<T>>(
  query: T,
  filters: ListTasksInput,
): T {
  let filteredQuery = query;

  if (filters.today) {
    const today = getTodayIsoDate();
    filteredQuery = filteredQuery.or(
      `scheduled_for.eq.${today},due_on.eq.${today}`,
    );
  }

  if (filters.dateFrom) {
    filteredQuery = filteredQuery.gte(filters.dateField, filters.dateFrom);
  }

  if (filters.dateTo) {
    filteredQuery = filteredQuery.lte(filters.dateField, filters.dateTo);
  }

  if (filters.status !== undefined) {
    filteredQuery = Array.isArray(filters.status)
      ? filteredQuery.in("status", filters.status)
      : filteredQuery.eq("status", filters.status);
  }

  if (filters.priority !== undefined) {
    filteredQuery = Array.isArray(filters.priority)
      ? filteredQuery.in("priority", filters.priority)
      : filteredQuery.eq("priority", filters.priority);
  }

  if (filters.listId !== undefined) {
    filteredQuery = filters.listId === null
      ? filteredQuery.is("list_id", null)
      : filteredQuery.eq("list_id", filters.listId);
  }

  if (filters.goalId !== undefined) {
    filteredQuery = filters.goalId === null
      ? filteredQuery.is("goal_id", null)
      : filteredQuery.eq("goal_id", filters.goalId);
  }

  if (filters.scheduledFor !== undefined) {
    filteredQuery = filters.scheduledFor === null
      ? filteredQuery.is("scheduled_for", null)
      : filteredQuery.eq("scheduled_for", filters.scheduledFor);
  }

  if (filters.dueOn !== undefined) {
    filteredQuery = filters.dueOn === null
      ? filteredQuery.is("due_on", null)
      : filteredQuery.eq("due_on", filters.dueOn);
  }

  return filteredQuery;
}

export function registerTaskTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_tasks",
    {
      title: "List Tasks",
      description:
        "List tasks with optional filters for today, date ranges, status, list, goal, priority, scheduled date, and due date.",
      inputSchema: listTasksInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (filters) => {
      const query = applyTaskFilters(
        ctx.supabase
          .from("tasks")
          .select("*")
          .eq("user_id", ctx.userId)
          .order("status")
          .order("priority")
          .order("due_on"),
        filters,
      );

      const { data, error } = await query;
      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "get_task",
    {
      title: "Get Task",
      description: "Get a single task by ID.",
      inputSchema: { taskId: uuidSchema },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ taskId }) => {
      const { data, error } = await ctx.supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (error) return toolError(error.message);
      if (!data) return toolError("Task not found");
      return toolJson(data);
    },
  );

  server.registerTool(
    "create_task",
    {
      title: "Create Task",
      description:
        "Create a new task for the authenticated user. `subtasks` is an " +
        "optional checklist of `{id, title, status}` items stored on the task " +
        "itself — they are not tasks and have no fields beyond these. Mint " +
        "each `id` yourself; it only needs to be unique within this array.",
      inputSchema: {
        title: z.string().min(1).max(100),
        dueOn: dateSchema.nullable().optional(),
        goalId: uuidSchema.nullable().optional(),
        listId: uuidSchema.nullable().optional(),
        priority: taskPrioritySchema.optional(),
        scheduledFor: dateSchema.nullable().optional(),
        status: taskStatusSchema.optional(),
        subtasks: subtasksSchema.optional(),
        templateId: uuidSchema.nullable().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (task) => {
      const { data, error } = await ctx.supabase
        .from("tasks")
        .insert({
          user_id: ctx.userId,
          title: task.title,
          due_on: task.dueOn ?? null,
          goal_id: task.goalId ?? null,
          list_id: task.listId ?? null,
          priority: task.priority,
          scheduled_for: task.scheduledFor ?? null,
          status: task.status,
          subtasks: task.subtasks ?? [],
          template_id: task.templateId ?? null,
        })
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "update_task",
    {
      title: "Update Task",
      description:
        "Update one or more task fields. Only provided fields are changed. " +
        "`subtasks` REPLACES the whole checklist array — to change one item, " +
        "read the task first, modify the array, and send it back in full. " +
        "Setting `status` to done (2) or won't-do (3) also sweeps every " +
        "subtask to that status automatically, so do not send `subtasks` " +
        "just to close them; send it only to make a different change.",
      inputSchema: {
        taskId: uuidSchema,
        title: z.string().min(1).max(100).optional(),
        dueOn: dateSchema.nullable().optional(),
        goalId: uuidSchema.nullable().optional(),
        listId: uuidSchema.nullable().optional(),
        priority: taskPrioritySchema.optional(),
        scheduledFor: dateSchema.nullable().optional(),
        status: taskStatusSchema.optional(),
        subtasks: subtasksSchema.optional(),
        templateId: uuidSchema.nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ taskId, ...fields }) => {
      const update = compactUpdate({
        title: fields.title,
        due_on: fields.dueOn,
        goal_id: fields.goalId,
        list_id: fields.listId,
        priority: fields.priority,
        scheduled_for: fields.scheduledFor,
        status: fields.status,
        subtasks: fields.subtasks,
        template_id: fields.templateId,
      });

      if (!hasUpdates(update)) {
        return toolError("No fields provided to update.");
      }

      // Recurrence only fires when THIS update sets a completion status (a
      // fresh completion), not when an already-done task is edited. Gate on the
      // incoming status — matching the app's `diff.status` guard — and read the
      // pre-update status in the same case so a re-completion is skipped.
      const isCompleting = isCompletionStatus(update.status);
      let previousStatus: number | null | undefined;
      if (isCompleting) {
        const completion = await readForCompletion(
          ctx,
          taskId,
          update.status as number,
        );
        previousStatus = completion.previousStatus;

        // Fold the checklist sweep into this same write so a completed parent
        // is never briefly stored alongside open children. An explicit
        // `subtasks` from the caller wins.
        if (fields.subtasks === undefined && completion.sweptSubtasks) {
          update.subtasks = completion.sweptSubtasks;
        }
      }

      const { data, error } = await ctx.supabase
        .from("tasks")
        .update(update)
        .eq("id", taskId)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return toolError(error.message);

      if (isCompleting) {
        await maybeCreateNextRecurringTask(ctx, data, previousStatus);
      }
      return toolJson(data);
    },
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete Task",
      description:
        "Permanently delete a task. If the task has a linked repeat schedule, " +
        "its template is deleted too, which stops future occurrences from being " +
        "created — confirm this with the user before deleting a repeat task.",
      inputSchema: { taskId: uuidSchema },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ taskId }) => {
      // Deleting a task doesn't cascade to its template (the FK is ON DELETE SET
      // NULL), so a repeat task's template must be removed explicitly to stop
      // future occurrences.
      const { data: task } = await ctx.supabase
        .from("tasks")
        .select("template_id")
        .eq("id", taskId)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      const { error } = await ctx.supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .eq("user_id", ctx.userId);

      if (error) return toolError(error.message);

      if (task?.template_id) {
        const { error: templateError } = await ctx.supabase
          .from("repeat_task_templates")
          .delete()
          .eq("id", task.template_id)
          .eq("user_id", ctx.userId);

        if (templateError) return toolError(templateError.message);
      }

      return toolJson({ success: true, taskId });
    },
  );

  server.registerTool(
    "archive_task",
    {
      title: "Archive Task",
      description:
        "Archive a task by setting its status to won't-do, or restore it to " +
        "todo. Archiving also sweeps the task's subtasks to won't-do; " +
        "restoring leaves them as they are.",
      inputSchema: {
        taskId: uuidSchema,
        restore: z.boolean().optional().default(false),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ taskId, restore }) => {
      // Archiving to won't-do can complete a repeat task; read the prior status
      // first so a re-archive doesn't spawn a duplicate occurrence.
      let previousStatus: number | null | undefined;
      let sweptSubtasks: Subtask[] | undefined;
      if (!restore) {
        // Archiving is a completion, so it sweeps the checklist in the same
        // write — the mirror of update_task. Restoring does not: a restored
        // task returns to todo with its checklist as the user left it.
        const completion = await readForCompletion(
          ctx,
          taskId,
          TASK_STATUS_WONT_DO,
        );
        previousStatus = completion.previousStatus;
        sweptSubtasks = completion.sweptSubtasks;
      }

      const { data, error } = await ctx.supabase
        .from("tasks")
        .update({
          status: restore ? TASK_STATUS_TODO : TASK_STATUS_WONT_DO,
          ...(sweptSubtasks ? { subtasks: sweptSubtasks } : {}),
        })
        .eq("id", taskId)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return toolError(error.message);

      if (!restore) {
        await maybeCreateNextRecurringTask(ctx, data, previousStatus);
      }
      return toolJson(data);
    },
  );
}
