/**
 * The one-open-task invariant, server-side.
 *
 * **A repeat has exactly one open task.** A schedule on its own generates
 * nothing: recurrence spawns from *completing* a task whose `template_id` points
 * at a scheduled `repeat_task_templates` row. So a repeat with no open task can
 * never fire again, and one with several would fire several parallel chains.
 * These are the two halves of that guarantee — "don't create a second"
 * (`hasOpenTaskForTemplate`) and "don't leave zero" (`seedNextOccurrence`) —
 * mirroring `src/api/tasks.ts` and `src/hooks/useTemplates.tsx` in the app.
 *
 * Lives in its own module rather than in `tasks.ts` because both the task tools
 * (which spawn on completion) and the template tools (which seed on write) need
 * it, and `templates.ts` importing `tasks.ts` would be backwards.
 *
 * **Scope (DEX-94).** Only the *template* write paths seed. `create_task` with a
 * `templateId` can still add a second open task, and `update_task` can still
 * clear the last one — the Expo app has the identical gap, guarding them would
 * cost a lookup on every task write, and Settings → Tasks already flags a
 * stalled repeat beside a one-tap repair.
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
 * Whether a template still has something to fire from. Since `template_id` also
 * records provenance for tasks stamped from a template, a template's links may
 * all be long since checked off — so this asks about *open* tasks specifically.
 *
 * **A failed lookup reports `true`,** which makes every caller bail: an extra
 * parallel chain is silent and permanent, whereas a repeat left with no open
 * task is surfaced in Settings → Tasks with a one-tap repair.
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
    // Each occurrence gets its own copy of the template's checklist, reset to
    // open. Array items carry no template link, so no orphan-spawn hazard.
    subtasks: subtasksFromTemplate(
      readTemplateSubtasks(template.subtasks),
      ETaskStatus.TODO,
    ),
  });
}

/**
 * Gives a repeat its one open task, unless it already has one — the mirror of
 * `seedNextOccurrence` in `src/hooks/useTemplates.tsx`. A no-op for a
 * scheduleless row (a task template is stamped on demand and never recurs).
 *
 * Uses `getFirstOccurrence`, not `getNextOccurrence`: it counts today, so a
 * cadence that matches today produces a task now rather than looking like
 * nothing happened.
 */
export async function seedNextOccurrence(
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
 * The seed as a best-effort step hanging off another write.
 *
 * Seeding is a *repair*, not part of the write the caller asked for: the
 * template row has already landed by the time it runs, and a repeat left with no
 * open task is surfaced and one-tap fixable in Settings → Tasks. Reporting a
 * save that succeeded as a failure would be worse — an agent that retries a
 * failed `create_template` writes a second row.
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
