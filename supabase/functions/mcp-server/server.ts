import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@src/types/database.types.ts";
import { registerTools } from "../_shared/mcp-tools/index.ts";
import type { ToolRegistrar } from "../_shared/mcp-tools/types.ts";

export type { ToolContext } from "../_shared/mcp-tools/types.ts";

export function createMcpServer(
  supabase: SupabaseClient<Database>,
  user: User,
): McpServer {
  const server = new McpServer({
    name: "dexter",
    version: "1.0.0",
  });

  const registrar: ToolRegistrar = {
    registerTool(name, config, callback) {
      const inputSchema = z.object(
        config.inputSchema ?? ({} as NonNullable<typeof config.inputSchema>),
      );
      server.registerTool<never, typeof inputSchema>(
        name,
        { ...config, inputSchema },
        (args) => callback(args),
      );
    },
  };
  registerTools(registrar, { supabase, userId: user.id });

  return server;
}
