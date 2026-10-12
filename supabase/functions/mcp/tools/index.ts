import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { registerTools as registerDexterTools } from "../../_shared/mcp-tools/index.ts";
import type { ToolRegistrar } from "../../_shared/mcp-tools/types.ts";
import { captureException } from "../../_shared/sentry.ts";
import { jsonResult, runtimeErrorResult } from "./result.ts";
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
          const result = await callback(args);
          const text = result.content[0].text;
          return result.isError
            ? runtimeErrorResult(new Error(text))
            : jsonResult(JSON.parse(text));
        } catch (error) {
          captureException(error);
          return runtimeErrorResult(
            new Error("Unable to complete this tool request."),
          );
        }
      });
    },
  };

  registerDexterTools(registrar, {
    supabase: context.supabase,
    userId: context.userClaims.id,
  });
}
