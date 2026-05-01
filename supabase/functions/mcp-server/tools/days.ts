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

export function registerDayTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "get_day",
    {
      title: "Get Day",
      description: "Get notes and journal prompts for a specific date.",
      inputSchema: { date: dateSchema },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ date }) => {
      const { data, error } = await ctx.supabase
        .from("days")
        .select("*")
        .eq("date", date)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (error) return toolError(error.message);
      if (!data) return toolError("Day not found");
      return toolJson(data);
    },
  );

  server.registerTool(
    "upsert_day",
    {
      title: "Upsert Day",
      description:
        "Create or update the authenticated user's day row for a date. Supports notes and prompts.",
      inputSchema: {
        date: dateSchema,
        notes: z.string().nullable().optional(),
        prompts: z.array(journalPromptSchema).nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ date, notes, prompts }) => {
      const values = compactUpdate({
        date,
        user_id: ctx.userId,
        notes,
        prompts,
      });

      if (!hasUpdates(compactUpdate({ notes, prompts }))) {
        return toolError("No fields provided to upsert.");
      }

      const { data, error } = await ctx.supabase
        .from("days")
        .upsert(values, { onConflict: "date,user_id" })
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );
}
