import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ToolContext } from "../server.ts";
import {
  compactUpdate,
  dateSchema,
  hasUpdates,
  toolError,
  toolJson,
  uuidSchema,
} from "./helpers.ts";

const daysActiveSchema = z.array(z.number().int().min(0).max(6)).min(1);

export const updateDailyHabitInputSchema = {
  date: dateSchema,
  habitId: uuidSchema,
  stepsComplete: z.number().int().min(0),
};

export function registerHabitTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_habits",
    {
      title: "List Habits",
      description: "List habits. Archived habits are excluded by default.",
      inputSchema: { includeArchived: z.boolean().optional().default(false) },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ includeArchived }) => {
      let query = ctx.supabase
        .from("habits")
        .select("*")
        .eq("user_id", ctx.userId)
        .order("title");

      if (!includeArchived) {
        query = query.eq("is_archived", false);
      }

      const { data, error } = await query;
      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "get_habit",
    {
      title: "Get Habit",
      description: "Get a single habit by ID.",
      inputSchema: { habitId: uuidSchema },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ habitId }) => {
      const { data, error } = await ctx.supabase
        .from("habits")
        .select("*")
        .eq("id", habitId)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (error) return toolError(error.message);
      if (!data) return toolError("Habit not found");
      return toolJson(data);
    },
  );

  server.registerTool(
    "create_habit",
    {
      title: "Create Habit",
      description: "Create a new habit for the authenticated user.",
      inputSchema: {
        title: z.string().min(1),
        emoji: z.string().min(1),
        steps: z.number().int().min(1),
        daysActive: daysActiveSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ title, emoji, steps, daysActive }) => {
      const { data, error } = await ctx.supabase
        .from("habits")
        .insert({
          user_id: ctx.userId,
          title,
          emoji,
          steps,
          days_active: daysActive,
        })
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "update_habit",
    {
      title: "Update Habit",
      description: "Update one or more habit fields.",
      inputSchema: {
        habitId: uuidSchema,
        title: z.string().min(1).optional(),
        emoji: z.string().min(1).optional(),
        steps: z.number().int().min(1).optional(),
        daysActive: daysActiveSchema.optional(),
        isArchived: z.boolean().optional(),
        isPaused: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (
      { habitId, title, emoji, steps, daysActive, isArchived, isPaused },
    ) => {
      const update = compactUpdate({
        title,
        emoji,
        steps,
        days_active: daysActive,
        is_archived: isArchived,
        is_paused: isPaused,
      });

      if (!hasUpdates(update)) {
        return toolError("No fields provided to update.");
      }

      const { data, error } = await ctx.supabase
        .from("habits")
        .update(update)
        .eq("id", habitId)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "archive_habit",
    {
      title: "Archive Habit",
      description: "Archive a habit, or restore it by setting restore to true.",
      inputSchema: {
        habitId: uuidSchema,
        restore: z.boolean().optional().default(false),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ habitId, restore }) => {
      const { data, error } = await ctx.supabase
        .from("habits")
        .update({ is_archived: !restore })
        .eq("id", habitId)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "list_daily_habits",
    {
      title: "List Daily Habits",
      description:
        "List daily habit progress rows for a date, including the linked habit.",
      inputSchema: { date: dateSchema },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ date }) => {
      const { data, error } = await ctx.supabase
        .from("daily_habits")
        .select("*, habits(*)")
        .eq("date", date)
        .eq("user_id", ctx.userId)
        .order("habit_id");

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "get_daily_habit",
    {
      title: "Get Daily Habit",
      description: "Get one daily habit progress row by date and habit ID.",
      inputSchema: {
        date: dateSchema,
        habitId: uuidSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ date, habitId }) => {
      const { data, error } = await ctx.supabase
        .from("daily_habits")
        .select("*, habits(*)")
        .eq("date", date)
        .eq("habit_id", habitId)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (error) return toolError(error.message);
      if (!data) return toolError("Daily habit not found");
      return toolJson(data);
    },
  );

  server.registerTool(
    "update_daily_habit",
    {
      title: "Update Daily Habit",
      description:
        "Update daily habit progress. Only stepsComplete is writable; percent_complete is generated by the database.",
      inputSchema: updateDailyHabitInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ date, habitId, stepsComplete }) => {
      const { data, error } = await ctx.supabase
        .from("daily_habits")
        .update({ steps_complete: stepsComplete })
        .eq("date", date)
        .eq("habit_id", habitId)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );
}
