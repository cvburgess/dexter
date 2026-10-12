import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { captureException } from "../../_shared/sentry.ts";
import { registerGoalTools } from "./goals.ts";
import { registerHabitTools } from "./habits.ts";
import { registerJournalTools } from "./journals.ts";
import { registerListTools } from "./lists.ts";
import { registerNoteTools } from "./notes.ts";
import { registerPreferenceTools } from "./preferences.ts";
import { registerSearchTools } from "./search.ts";
import { registerTaskTools } from "./tasks.ts";
import { registerTemplateTools } from "./templates.ts";
import type { ToolContext, ToolRegistrar } from "./types.ts";

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

  registerTaskTools(registrar, context);
  registerGoalTools(registrar, context);
  registerListTools(registrar, context);
  registerHabitTools(registrar, context);
  registerNoteTools(registrar, context);
  registerJournalTools(registrar, context);
  registerTemplateTools(registrar, context);
  registerPreferenceTools(registrar, context);
  registerSearchTools(registrar, context);
}
