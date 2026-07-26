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

// Bounded like the sibling jsonb array on tasks (`subtasksSchema` in
// helpers.ts): a runaway client must not be able to write a multi-megabyte array
// into a row. Prompts are short labels mirroring `preferences.template_prompts`;
// responses are user prose and stay unbounded.
const MAX_JOURNAL_PROMPTS = 50;

const journalPromptSchema = z.object({
  prompt: z.string().max(200),
  response: z.string(),
});

const journalPromptsSchema = z.array(journalPromptSchema).max(
  MAX_JOURNAL_PROMPTS,
);

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
