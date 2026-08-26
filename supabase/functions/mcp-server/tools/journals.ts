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
// `period` says which ritual asks the prompt (DEX-151). It **must** be listed
// here even though nothing on this side reads it: `z.object` strips keys it
// does not declare, so an agent doing the documented get_journal →
// upsert_journal round trip would silently write the day back with every period
// erased, and the app would show the whole day in the morning ritual and
// nothing in the evening one.
//
// Optional because the stored rows are: entries written before the split carry
// no period, and `promptPeriod` in the app reads a missing one as morning.
const journalPromptSchema = z.object({
  prompt: z.string(),
  response: z.string(),
  period: z.enum(["am", "pm"]).optional(),
});

const journalPromptsSchema = z.array(journalPromptSchema);

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
      if (!data) return toolJson({ date, prompts: [], user_id: ctx.userId });
      return toolJson(data);
    },
  );

  server.registerTool(
    "upsert_journal",
    {
      title: "Upsert Journal",
      description:
        "Create or update the authenticated user's journal prompts for a date. Replaces the entire prompt array — read it with get_journal first and send every entry back, or the omitted ones are lost. Pass an empty array to clear it.",
      inputSchema: {
        date: dateSchema,
        // Not nullable: `journals.prompts` is NOT NULL (and constrained to a
        // jsonb array), so clearing the journal is an empty array, not a null.
        prompts: journalPromptsSchema.optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ date, prompts }) => {
      const updates = compactUpdate({ prompts });

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
