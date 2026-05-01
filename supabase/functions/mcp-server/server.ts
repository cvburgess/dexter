import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@src/types/database.types.ts";
import { registerDayTools } from "./tools/days.ts";
import { registerGoalTools } from "./tools/goals.ts";
import { registerHabitTools } from "./tools/habits.ts";
import { registerListTools } from "./tools/lists.ts";
import { registerPreferenceTools } from "./tools/preferences.ts";
import { registerTaskTools } from "./tools/tasks.ts";
import { registerTemplateTools } from "./tools/templates.ts";

export interface ToolContext {
  supabase: SupabaseClient<Database>;
  userId: string;
}

export function createMcpServer(
  supabase: SupabaseClient<Database>,
  user: User,
): McpServer {
  const server = new McpServer({
    name: "dexter",
    version: "1.0.0",
  });

  const ctx: ToolContext = { supabase, userId: user.id };

  registerTaskTools(server, ctx);
  registerGoalTools(server, ctx);
  registerListTools(server, ctx);
  registerHabitTools(server, ctx);
  registerDayTools(server, ctx);
  registerTemplateTools(server, ctx);
  registerPreferenceTools(server, ctx);

  return server;
}
