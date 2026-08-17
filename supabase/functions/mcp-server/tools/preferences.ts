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
   * How many breaths the Ritual's Breathe step opens with (DEX-164). Bounded
   * here where the column is not, for the reason `focusBlockMinutes` is: the
   * app clamps whatever it reads, but there is no reason to let an agent store
   * a zero the user would have to go and undo.
   *
   * The bounds restate `MIN_BREATHS`/`MAX_BREATHS` and must move with them.
   * Not imported: `utils/breathing.ts` pulls in `Temporal`, so it is not one of
   * the import-free modules Deno can read over `@src/` (see docs/backend.md,
   * "Code shared with the app").
   */
  breathCount: z.number().int().min(1).max(10).optional(),
  /**
   * Which pattern that step opens with. `"shuffle"` is a real stored value, not
   * an absence — it means a different technique each day, resolved from the
   * ritual's date.
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
   * How long a focus block runs, in whole minutes (DEX-49). The column itself is
   * unconstrained so an older client can read a length it doesn't offer, but
   * there is no reason to let an agent write a zero or a negative one.
   */
  focusBlockMinutes: z.number().int().positive().optional(),
  lightTheme: z.string().min(1).optional(),
  /**
   * The sign the Ritual's Horoscope step reads (DEX-128). `.nullable()` as well
   * as `.optional()`, and the two mean different things here: omitting the
   * field leaves the stored sign alone, while an explicit `null` clears it back
   * to unset. `compactUpdate` only strips `undefined`, so the null survives.
   */
  sunSign: sunSignSchema.nullable().optional(),
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
