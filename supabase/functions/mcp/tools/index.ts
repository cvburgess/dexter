import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { registerTools as registerDexterTools } from "../../_shared/mcp-tools/index.ts";
import type { ToolRegistrar } from "../../_shared/mcp-tools/types.ts";
import { captureException } from "../../_shared/sentry.ts";
import type { ToolContext } from "./types.ts";

export type { ToolContext } from "./types.ts";

export function registerTools(server: McpServer, context: ToolContext): void {
  const registrar: ToolRegistrar = {
    registerTool(name, config, callback) {
      const inputSchema = z.object(
        config.inputSchema ?? ({} as NonNullable<typeof config.inputSchema>),
      );
      server.registerTool(name, { ...config, inputSchema }, async (args) => {
        try {
          return await callback(args);
        } catch (error) {
          captureException(error);
          return {
            isError: true,
            content: [{
              type: "text",
              text: "Unable to complete this tool request.",
            }],
          };
        }
      });
    },
  };

  registerDexterTools(registrar, {
    supabase: context.supabase,
    userId: context.userClaims.id,
  });
}
