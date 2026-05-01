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

export function registerGoalTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_goals",
    {
      title: "List Goals",
      description: "List goals. Archived goals are excluded by default.",
      inputSchema: { includeArchived: z.boolean().optional().default(false) },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ includeArchived }) => {
      let query = ctx.supabase
        .from("goals")
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
    "get_goal",
    {
      title: "Get Goal",
      description: "Get a single goal by ID.",
      inputSchema: { goalId: uuidSchema },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ goalId }) => {
      const { data, error } = await ctx.supabase
        .from("goals")
        .select("*")
        .eq("id", goalId)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (error) return toolError(error.message);
      if (!data) return toolError("Goal not found");
      return toolJson(data);
    },
  );

  server.registerTool(
    "create_goal",
    {
      title: "Create Goal",
      description: "Create a new goal for the authenticated user.",
      inputSchema: {
        title: z.string().min(1),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ title }) => {
      const { data, error } = await ctx.supabase
        .from("goals")
        .insert({ user_id: ctx.userId, title })
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "update_goal",
    {
      title: "Update Goal",
      description: "Update one or more goal fields.",
      inputSchema: {
        goalId: uuidSchema,
        title: z.string().min(1).optional(),
        isArchived: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ goalId, title, isArchived }) => {
      const update = compactUpdate({
        title,
        is_archived: isArchived,
      });

      if (!hasUpdates(update)) {
        return toolError("No fields provided to update.");
      }

      const { data, error } = await ctx.supabase
        .from("goals")
        .update(update)
        .eq("id", goalId)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );

  server.registerTool(
    "archive_goal",
    {
      title: "Archive Goal",
      description: "Archive a goal, or restore it by setting restore to true.",
      inputSchema: {
        goalId: uuidSchema,
        restore: z.boolean().optional().default(false),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ goalId, restore }) => {
      const { data, error } = await ctx.supabase
        .from("goals")
        .update({ is_archived: !restore })
        .eq("id", goalId)
        .eq("user_id", ctx.userId)
        .select()
        .single();

      if (error) return toolError(error.message);
      return toolJson(data);
    },
  );
}
