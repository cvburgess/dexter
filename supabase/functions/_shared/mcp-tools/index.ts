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

export function registerTools(
  server: ToolRegistrar,
  context: ToolContext,
): void {
  registerTaskTools(server, context);
  registerGoalTools(server, context);
  registerListTools(server, context);
  registerHabitTools(server, context);
  registerNoteTools(server, context);
  registerJournalTools(server, context);
  registerTemplateTools(server, context);
  registerPreferenceTools(server, context);
  registerSearchTools(server, context);
}
