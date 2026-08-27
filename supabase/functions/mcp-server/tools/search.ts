import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ToolContext } from "../server.ts";
import { toolError, toolJson } from "./helpers.ts";

/** The three things `search_entries` can return, as a tool-input filter. */
export const searchKindSchema = z.enum(["task", "note", "journal"]);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Declared separately so tests can apply its defaults before invoking the
 * handler directly, which would otherwise see `limit: undefined`.
 */
export const searchInputSchema = {
  query: z.string().min(1),
  // Omitted means all three. Narrowing is a filter on the result rows, not a
  // cheaper query — the RPC always searches everything.
  kinds: z.array(searchKindSchema).min(1).optional(),
  limit: z.number().int().min(1).max(MAX_LIMIT).optional().default(
    DEFAULT_LIMIT,
  ),
};

export const searchSchema = z.object(searchInputSchema);

export function registerSearchTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "search",
    {
      title: "Search",
      description:
        "Search the authenticated user's tasks, notes, and journal entries for a string. " +
        "Matching is case-insensitive substring matching, and every whitespace-separated " +
        'term must appear somewhere in the entry — so "buy milk" also finds a note reading ' +
        '"milk, remember to buy". Tasks match on their own title or any subtask title; ' +
        "notes match on their markdown content; journal entries match on the response only " +
        "(prompts come from a shared template, so searching them would return every entry), " +
        "and are returned one row per matching response. Results are ordered most " +
        "recent first. Each result carries a `kind` of task, note, or journal: tasks include " +
        "the full task row in `task`, notes put their full content in `content`, and journal " +
        "entries put the question in `prompt` and the answer in `content`. `entry_date` is " +
        "the day the entry belongs to, and is null for a task with no scheduled date.",
      inputSchema: searchInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ query, kinds, limit }) => {
      // No `.eq("user_id", ...)` here, unlike other tools: `search_entries` is
      // SECURITY INVOKER, so RLS already scopes all three branches to the caller.
      let request = ctx.supabase.rpc("search_entries", { query });

      if (kinds) request = request.in("kind", kinds);

      const { data, error } = await request.limit(limit);

      if (error) return toolError(error.message);
      // No matches is ordinary, not a failure — an error here would page us
      // via `toolError`'s Sentry report for "no results".
      return toolJson(data ?? []);
    },
  );
}
