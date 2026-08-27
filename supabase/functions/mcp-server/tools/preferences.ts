import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ToolContext } from "../server.ts";
import {
  compactUpdate,
  hasUpdates,
  sunSignSchema,
  themeModeSchema,
  toolError,
  toolJson,
} from "./helpers.ts";

export const updatePreferencesInputSchema = {
  /**
   * DEX-164. Restates `MIN_BREATHS`/`MAX_BREATHS` and must move with them —
   * `utils/breathing.ts` pulls in `Temporal`, so Deno can't import it.
   */
  breathCount: z.number().int().min(1).max(10).optional(),
  /**
   * `"shuffle"` is a real stored value, not an absence — a different technique
   * each day, resolved from the ritual's date.
   */
  breathingTechnique: z
    .enum(["simple", "relax", "box", "shuffle"])
    .optional(),
  calendarEndTime: z.string().optional(),
  calendarStartTime: z.string().optional(),
  calendarUrls: z.array(z.string().url()).optional(),
  darkTheme: z.string().min(1).optional(),
  enableCalendar: z.boolean().optional(),
  enableHabits: z.boolean().optional(),
  enableHoroscope: z.boolean().optional(),
  enableJournal: z.boolean().optional(),
  enableNotes: z.boolean().optional(),
  /**
   * Whole minutes (DEX-49). The column is unconstrained so older clients can
   * read new lengths, but an agent has no reason to write zero or negative.
   */
  focusBlockMinutes: z.number().int().positive().optional(),
  lightTheme: z.string().min(1).optional(),
  /**
   * DEX-128: omitting the field keeps the stored sign; an explicit `null`
   * clears it — `compactUpdate` only strips `undefined`, so the null survives.
   */
  sunSign: sunSignSchema.nullable().optional(),
  templateNote: z.string().optional(),
  // The whole list, like the column stores it. `id` is optional — the handler
  // mints any that are missing, since that is the app's job, not an agent's.
  templatePrompts: z
    .array(
      z.object({
        id: z.string().optional(),
        prompt: z.string(),
        period: z.enum(["am", "pm"]),
      }),
    )
    .optional(),
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
        breath_count: fields.breathCount,
        breathing_technique: fields.breathingTechnique,
        calendar_end_time: fields.calendarEndTime,
        calendar_start_time: fields.calendarStartTime,
        calendar_urls: fields.calendarUrls,
        dark_theme: fields.darkTheme,
        enable_calendar: fields.enableCalendar,
        enable_habits: fields.enableHabits,
        enable_horoscope: fields.enableHoroscope,
        enable_journal: fields.enableJournal,
        enable_notes: fields.enableNotes,
        focus_block_minutes: fields.focusBlockMinutes,
        light_theme: fields.lightTheme,
        sun_sign: fields.sunSign,
        template_note: fields.templateNote,
        template_prompts: fields.templatePrompts?.map((entry) => ({
          ...entry,
          id: entry.id ?? crypto.randomUUID(),
        })),
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
