import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ToolContext } from "../server.ts";
import {
  compactUpdate,
  dateSchema,
  hasUpdates,
  toolError,
  toolJson,
} from "./helpers.ts";

// Deliberately unbounded, unlike the sibling jsonb array on tasks
// (`subtasksSchema` in helpers.ts). Those bounds work because they match limits
// the app itself enforces (`tasks.title` is varchar(100)); nothing bounds a
// journal prompt anywhere — not the settings editor, not `update_preferences`'
// `templatePrompts`, not `preferences.template_prompts` (unbounded varchar[]) —
// and `useJournals` seeds a row straight from that template via PostgREST, which
// runs no Zod. A cap here would therefore reject rows the app legitimately
// created: an agent doing the documented get_journal → upsert_journal round trip
// would be locked out of that user's journal for good. It would also buy little,
// since `response` here and `content` on notes are both unbounded prose. Bound
// `template_prompts` first if this ever needs a limit.
// `period` must be declared even though nothing here reads it: `z.object` strips
// undeclared keys, so a get_journal → upsert_journal round trip would erase it.
const journalPromptSchema = z.object({
  prompt: z.string(),
  response: z.string(),
  period: z.enum(["am", "pm"]).optional(),
});

const journalPromptsSchema = z.array(journalPromptSchema);

// Bounded where the prompt strings are not: `journals_mood_range` enforces the
// same 1-5, so a wider schema would only trade a clear error for a 400.
const moodSchema = z.number().int().min(1).max(5).nullable().optional();

export function registerJournalTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "get_journal",
    {
      title: "Get Journal",
      description: "Get the journal prompts and responses for a specific date.",
      inputSchema: { date: dateSchema },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ date }) => {
      const { data, error } = await ctx.supabase
        .from("journals")
        .select("*")
        .eq("date", date)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (error) return toolError(error.message);
      // A date with no row is the ordinary case, not a failure — see the
      // matching comment in get_note.
      if (!data) {
        return toolJson({ date, prompts: [], mood: null, user_id: ctx.userId });
      }
      return toolJson(data);
    },
  );

  server.registerTool(
    "upsert_journal",
    {
      title: "Upsert Journal",
      description:
        "Create or update the authenticated user's journal prompts and mood for a date. Replaces the entire prompt array — read it with get_journal first and send every entry back, or the omitted ones are lost. Pass an empty array to clear it. `mood` is a standalone 1-5 score; omit it to leave it untouched, or pass null to clear it.",
      inputSchema: {
        date: dateSchema,
        // Not nullable: `journals.prompts` is NOT NULL (and constrained to a
        // jsonb array), so clearing the journal is an empty array, not a null.
        prompts: journalPromptsSchema.optional(),
        // Nullable where `prompts` is not: the column is, and `compactUpdate`
        // keeps a null, so clearing a mood needs one.
        mood: moodSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ date, prompts, mood }) => {
      const updates = compactUpdate({ prompts, mood });

      if (!hasUpdates(updates)) {
        return toolError("No fields provided to upsert.");
      }

      const { data, error } = await ctx.supabase
        .from("journals")
        .upsert({ date, user_id: ctx.userId, ...updates }, {
          onConflict: "user_id,date",
        })
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );
}
