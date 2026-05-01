import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ToolContext } from "../server.ts";
import {
  compactUpdate,
  hasUpdates,
  toolError,
  toolJson,
  uuidSchema,
} from "./helpers.ts";

export function registerListTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_lists",
    {
      title: "List Lists",
      description: "List task lists. Archived lists are excluded by default.",
      inputSchema: { includeArchived: z.boolean().optional().default(false) },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ includeArchived }) => {
      let query = ctx.supabase
        .from("lists")
        .select("*")
        .eq("user_id", ctx.userId)
        .order("created_at");

      if (!includeArchived) {
        query = query.eq("is_archived", false);
      }

      const { data, error } = await query;
      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "get_list",
    {
      title: "Get List",
      description: "Get a single task list by ID.",
      inputSchema: { listId: uuidSchema },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ listId }) => {
      const { data, error } = await ctx.supabase
        .from("lists")
        .select("*")
        .eq("id", listId)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (error) return toolError(error.message);
      if (!data) return toolError("List not found");
      return toolJson(data);
    },
  );

  server.registerTool(
    "create_list",
    {
      title: "Create List",
      description: "Create a new task list for the authenticated user.",
      inputSchema: {
        title: z.string().min(1),
        emoji: z.string().min(1),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ title, emoji }) => {
      const { data, error } = await ctx.supabase
        .from("lists")
        .insert({ user_id: ctx.userId, title, emoji })
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "update_list",
    {
      title: "Update List",
      description: "Update one or more task list fields.",
      inputSchema: {
        listId: uuidSchema,
        title: z.string().min(1).optional(),
        emoji: z.string().min(1).optional(),
        isArchived: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ listId, title, emoji, isArchived }) => {
      const update = compactUpdate({
        title,
        emoji,
        is_archived: isArchived,
      });

      if (!hasUpdates(update)) {
        return toolError("No fields provided to update.");
      }

      const { data, error } = await ctx.supabase
        .from("lists")
        .update(update)
        .eq("id", listId)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "archive_list",
    {
      title: "Archive List",
      description:
        "Archive a task list, or restore it by setting restore to true.",
      inputSchema: {
        listId: uuidSchema,
        restore: z.boolean().optional().default(false),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ listId, restore }) => {
      const { data, error } = await ctx.supabase
        .from("lists")
        .update({ is_archived: !restore })
        .eq("id", listId)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );
}
