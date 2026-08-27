/**
 * The one-open-task invariant, server-side (DEX-94), mirroring the app's
 * useTemplates/tasks pair — rules and scope: docs/features.md "Repeats".
 */

import type { Database } from "@src/types/database.types.ts";
import { getFirstOccurrence } from "@src/utils/repeatSchedule.ts";
import { subtasksFromTemplate } from "@src/utils/subtasks.ts";
import { ETaskStatus, OPEN_TASK_STATUSES } from "@src/utils/taskStatus.ts";

import type { ToolContext } from "../server.ts";
import { getTodayIsoDate, storedTemplateSubtasksSchema } from "./helpers.ts";

export type TemplateRow =
  Database["public"]["Tables"]["repeat_task_templates"]["Row"];

/** Template checklist items carry no status — a template is a blueprint, not state. */
const readTemplateSubtasks = (value: unknown): { title: string }[] => {
  const parsed = storedTemplateSubtasksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

/**
 * A failed lookup reports `true`, making every caller bail: an extra parallel
 * chain is silent and permanent, where a stalled repeat has a ▶ repair.
 */
export async function hasOpenTaskForTemplate(
  ctx: ToolContext,
  templateId: string,
): Promise<boolean> {
  const { data, error } = await ctx.supabase
    .from("tasks")
    .select("id")
    .eq("template_id", templateId)
    .eq("user_id", ctx.userId)
    .in("status", OPEN_TASK_STATUSES)
    .limit(1);

  return Boolean(error) || !data || data.length > 0;
}

/** Stamps one open task from `template`, dated `scheduledFor`. */
export async function insertOccurrence(
  ctx: ToolContext,
  template: TemplateRow,
  scheduledFor: string,
): Promise<void> {
  await ctx.supabase.from("tasks").insert({
    user_id: ctx.userId,
    title: template.title,
    alarm_time: template.alarm_time,
    priority: template.priority,
    list_id: template.list_id,
    goal_id: template.goal_id,
    scheduled_for: scheduledFor,
    template_id: template.id,
    status: ETaskStatus.TODO,
    // Each occurrence gets its own copy of the template's checklist, all
    // unchecked. Array items carry no template link, so no orphan-spawn hazard.
    subtasks: subtasksFromTemplate(readTemplateSubtasks(template.subtasks)),
  });
}

/**
 * `getFirstOccurrence`, not `getNextOccurrence`: it counts today, so a cadence
 * matching today lands a task now rather than looking like nothing happened.
 */
async function seedNextOccurrence(
  ctx: ToolContext,
  template: TemplateRow,
): Promise<void> {
  if (!template.schedule) return;
  if (await hasOpenTaskForTemplate(ctx, template.id)) return;

  const scheduledFor = getFirstOccurrence(template.schedule, getTodayIsoDate());
  if (!scheduledFor) return;

  await insertOccurrence(ctx, template, scheduledFor);
}

/**
 * Best-effort: the template write already landed, and an agent retrying a
 * "failed" `create_template` writes a second row — a stalled repeat has a ▶ fix.
 */
export async function trySeedNextOccurrence(
  ctx: ToolContext,
  template: TemplateRow,
): Promise<void> {
  try {
    await seedNextOccurrence(ctx, template);
  } catch {
    // Swallowed on purpose — see above.
  }
}
