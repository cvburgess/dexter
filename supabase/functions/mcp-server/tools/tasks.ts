import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ToolContext } from "../server.ts";
import {
  compactUpdate,
  dateSchema,
  getTodayIsoDate,
  hasUpdates,
  taskPrioritySchema,
  taskStatusSchema,
  toolError,
  toolJson,
  uuidSchema,
} from "./helpers.ts";

const TASK_STATUS_TODO = 1;
const TASK_STATUS_WONT_DO = 3;

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
      description: "Create a new task for the authenticated user.",
      inputSchema: {
        title: z.string().min(1).max(100),
        dueOn: dateSchema.nullable().optional(),
        goalId: uuidSchema.nullable().optional(),
        listId: uuidSchema.nullable().optional(),
        priority: taskPrioritySchema.optional(),
        scheduledFor: dateSchema.nullable().optional(),
        status: taskStatusSchema.optional(),
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
        "Update one or more task fields. Only provided fields are changed.",
      inputSchema: {
        taskId: uuidSchema,
        title: z.string().min(1).max(100).optional(),
        dueOn: dateSchema.nullable().optional(),
        goalId: uuidSchema.nullable().optional(),
        listId: uuidSchema.nullable().optional(),
        priority: taskPrioritySchema.optional(),
        scheduledFor: dateSchema.nullable().optional(),
        status: taskStatusSchema.optional(),
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
        template_id: fields.templateId,
      });

      if (!hasUpdates(update)) {
        return toolError("No fields provided to update.");
      }

      const { data, error } = await ctx.supabase
        .from("tasks")
        .update(update)
        .eq("id", taskId)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete Task",
      description: "Permanently delete a task.",
      inputSchema: { taskId: uuidSchema },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ taskId }) => {
      const { error } = await ctx.supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .eq("user_id", ctx.userId);

      if (error) return toolError(error.message);
      return toolJson({ success: true, taskId });
    },
  );

  server.registerTool(
    "archive_task",
    {
      title: "Archive Task",
      description:
        "Archive a task by setting its status to won't-do, or restore it to todo.",
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
      const { data, error } = await ctx.supabase
        .from("tasks")
        .update({
          status: restore ? TASK_STATUS_TODO : TASK_STATUS_WONT_DO,
        })
        .eq("id", taskId)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );
}
