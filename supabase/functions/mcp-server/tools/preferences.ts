import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ToolContext } from "../server.ts";
import {
  compactUpdate,
  hasUpdates,
  themeModeSchema,
  toolError,
  toolJson,
} from "./helpers.ts";

export const updatePreferencesInputSchema = {
  calendarEndTime: z.string().optional(),
  calendarStartTime: z.string().optional(),
  calendarUrls: z.array(z.string().url()).optional(),
  darkTheme: z.string().min(1).optional(),
  enableCalendar: z.boolean().optional(),
  enableHabits: z.boolean().optional(),
  enableJournal: z.boolean().optional(),
  enableNotes: z.boolean().optional(),
  lightTheme: z.string().min(1).optional(),
  templateNote: z.string().optional(),
  templatePrompts: z.array(z.string()).optional(),
  themeMode: themeModeSchema.optional(),
};

export function registerPreferenceTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "get_preferences",
    {
      title: "Get Preferences",
      description: "Get the authenticated user's preferences row.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      const { data, error } = await ctx.supabase
        .from("preferences")
        .select("*")
        .eq("user_id", ctx.userId)
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "update_preferences",
    {
      title: "Update Preferences",
      description:
        "Update the authenticated user's preferences. Only provided fields are changed.",
      inputSchema: updatePreferencesInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (fields) => {
      const update = compactUpdate({
        calendar_end_time: fields.calendarEndTime,
        calendar_start_time: fields.calendarStartTime,
        calendar_urls: fields.calendarUrls,
        dark_theme: fields.darkTheme,
        enable_calendar: fields.enableCalendar,
        enable_habits: fields.enableHabits,
        enable_journal: fields.enableJournal,
        enable_notes: fields.enableNotes,
        light_theme: fields.lightTheme,
        template_note: fields.templateNote,
        template_prompts: fields.templatePrompts,
        theme_mode: fields.themeMode,
      });

      if (!hasUpdates(update)) {
        return toolError("No fields provided to update.");
      }

      const { data, error } = await ctx.supabase
        .from("preferences")
        .update(update)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );
}
