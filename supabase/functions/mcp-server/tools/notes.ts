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

export function registerNoteTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "get_note",
    {
      title: "Get Note",
      description: "Get the daily note for a specific date.",
      inputSchema: { date: dateSchema },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ date }) => {
      const { data, error } = await ctx.supabase
        .from("notes")
        .select("*")
        .eq("date", date)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (error) return toolError(error.message);
      // No row is ordinary, unlike id-keyed getters where a miss is a bad
      // reference — an error here would page us via toolError's Sentry report.
      if (!data) return toolJson({ date, content: "", user_id: ctx.userId });
      return toolJson(data);
    },
  );

  server.registerTool(
    "upsert_note",
    {
      title: "Upsert Note",
      description:
        "Create or update the authenticated user's daily note for a date. Replaces the note's entire markdown content — read it with get_note first and send the full text to append or edit. Pass an empty string to clear it.",
      inputSchema: {
        date: dateSchema,
        // Not nullable: `notes.content` is NOT NULL, so clearing a note is an
        // empty string rather than a null.
        content: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ date, content }) => {
      const updates = compactUpdate({ content });

      if (!hasUpdates(updates)) {
        return toolError("No fields provided to upsert.");
      }

      const { data, error } = await ctx.supabase
        .from("notes")
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
