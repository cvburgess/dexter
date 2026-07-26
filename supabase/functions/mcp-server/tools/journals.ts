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

const journalPromptSchema = z.object({
  prompt: z.string(),
  response: z.string(),
});

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
      if (!data) return toolError("Journal not found");
      return toolJson(data);
    },
  );

  server.registerTool(
    "upsert_journal",
    {
      title: "Upsert Journal",
      description:
        "Create or update the authenticated user's journal prompts for a date. Replaces the whole prompt array.",
      inputSchema: {
        date: dateSchema,
        // Not nullable: `journals.prompts` is NOT NULL (and constrained to a
        // jsonb array), so clearing the journal is an empty array, not a null.
        prompts: z.array(journalPromptSchema).optional(),
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
