import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ToolContext } from "../server.ts";
import {
  compactUpdate,
  cronScheduleSchema,
  hasUpdates,
  taskPrioritySchema,
  templateSubtasksSchema,
  toolError,
  toolJson,
  uuidSchema,
} from "./helpers.ts";

function templateError(message: string): ReturnType<typeof toolError> {
  if (
    message.includes("repeat_task_templates") || message.includes("schedule")
  ) {
    return toolError(`Invalid repeat task template: ${message}`);
  }

  return toolError(message);
}

export function registerTemplateTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "list_templates",
    {
      title: "List Repeat Task Templates",
      description: "List repeat task templates for the authenticated user.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      const { data, error } = await ctx.supabase
        .from("repeat_task_templates")
        .select("*")
        .eq("user_id", ctx.userId)
        .order("created_at");

      if (error) return templateError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "get_template",
    {
      title: "Get Repeat Task Template",
      description: "Get a single repeat task template by ID.",
      inputSchema: { templateId: uuidSchema },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ templateId }) => {
      const { data, error } = await ctx.supabase
        .from("repeat_task_templates")
        .select("*")
        .eq("id", templateId)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (error) return templateError(error.message);
      if (!data) return toolError("Repeat task template not found");
      return toolJson(data);
    },
  );

  server.registerTool(
    "create_template",
    {
      title: "Create Repeat Task Template",
      description:
        "Create a repeat task template with a validated cron schedule. " +
        "`subtasks` is an optional checklist blueprint of `{id, title}` " +
        "items — no status, since each generated occurrence starts its own " +
        "copy fresh and open.",
      inputSchema: {
        title: z.string().min(1),
        priority: taskPrioritySchema.optional(),
        schedule: cronScheduleSchema.optional(),
        goalId: uuidSchema.nullable().optional(),
        listId: uuidSchema.nullable().optional(),
        subtasks: templateSubtasksSchema.optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ title, priority, schedule, goalId, listId, subtasks }) => {
      const { data, error } = await ctx.supabase
        .from("repeat_task_templates")
        .insert({
          user_id: ctx.userId,
          title,
          priority,
          schedule,
          goal_id: goalId ?? null,
          list_id: listId ?? null,
          subtasks: subtasks ?? [],
        })
        .select()
        .single();

      if (error) return templateError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "update_template",
    {
      title: "Update Repeat Task Template",
      description:
        "Update one or more repeat task template fields. `subtasks` REPLACES " +
        "the whole checklist blueprint — read the template first, modify the " +
        "array, and send it back in full. Changing it affects future " +
        "occurrences only; checklists already materialized onto existing " +
        "tasks are independent copies and are left alone.",
      inputSchema: {
        templateId: uuidSchema,
        title: z.string().min(1).optional(),
        priority: taskPrioritySchema.optional(),
        schedule: cronScheduleSchema.optional(),
        goalId: uuidSchema.nullable().optional(),
        listId: uuidSchema.nullable().optional(),
        subtasks: templateSubtasksSchema.optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (
      { templateId, title, priority, schedule, goalId, listId, subtasks },
    ) => {
      const update = compactUpdate({
        title,
        priority,
        schedule,
        goal_id: goalId,
        list_id: listId,
        subtasks,
      });

      if (!hasUpdates(update)) {
        return toolError("No fields provided to update.");
      }

      const { data, error } = await ctx.supabase
        .from("repeat_task_templates")
        .update(update)
        .eq("id", templateId)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return templateError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "delete_template",
    {
      title: "Delete Repeat Task Template",
      description: "Permanently delete a repeat task template.",
      inputSchema: { templateId: uuidSchema },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ templateId }) => {
      const { error } = await ctx.supabase
        .from("repeat_task_templates")
        .delete()
        .eq("id", templateId)
        .eq("user_id", ctx.userId);

      if (error) return templateError(error.message);
      return toolJson({ success: true, templateId });
    },
  );
}
