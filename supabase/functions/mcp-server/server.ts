import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@src/types/database.types.ts";
import { registerGoalTools } from "./tools/goals.ts";
import { registerHabitTools } from "./tools/habits.ts";
import { registerJournalTools } from "./tools/journals.ts";
import { registerListTools } from "./tools/lists.ts";
import { registerNoteTools } from "./tools/notes.ts";
import { registerPreferenceTools } from "./tools/preferences.ts";
import { registerSearchTools } from "./tools/search.ts";
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
  registerNoteTools(server, ctx);
  registerJournalTools(server, ctx);
  registerTemplateTools(server, ctx);
  registerPreferenceTools(server, ctx);
  registerSearchTools(server, ctx);

  return server;
}
