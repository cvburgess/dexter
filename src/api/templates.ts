import { SupabaseClient } from "@supabase/supabase-js";

import { camelCase, snakeCase } from "@/utils/changeCase";
import { Database, TablesInsert, TablesUpdate } from "@/types/database.types";

import { ETaskPriority, TTask } from "./tasks";

/**
 * No `status`, unlike a task's subtask — a template is a blueprint, not state;
 * each occurrence materializes its own copy (see `subtasksFromTemplate`).
 */
export type TTemplateSubtask = {
  id: string;
  title: string;
};

export type TTemplate = {
  id: string;
  alarmTime: string | null;
  createdAt: string;
  goalId: string | null;
  listId: string | null;
  priority: ETaskPriority;
  /**
   * A midnight cron expression, or null when this row is a plain task template
   * rather than a repeat task — see `isTaskTemplate` (DEX-65).
   */
  schedule: string | null;
  subtasks: TTemplateSubtask[];
  title: string;
  userId: string;
};

/**
 * Repeat tasks and task templates share the table; a row with no schedule is a
 * blueprint, and both recurrence paths bail on a falsy schedule (DEX-65).
 */
export const isTaskTemplate = (template: TTemplate) =>
  template.schedule === null;

/**
 * Editor-route stand-in until the row exists, mirroring the list and habit
 * editors' `id: "new"`. A real id is a uuid, so this can never collide.
 */
export const NEW_TEMPLATE = "new";

/** The other half of `isTaskTemplate`, so neither side reads as a negation. */
export const isRepeatTask = (template: TTemplate) => !isTaskTemplate(template);

/**
 * The task minus everything owned by one occurrence — dates and progress. Shared
 * by "Repeat" (writes immediately) and "Save as template" (seeds a draft).
 */
export const templateFieldsFromTask = (task: TTask) => ({
  alarmTime: task.alarmTime,
  goalId: task.goalId,
  listId: task.listId,
  priority: task.priority,
  title: task.title,
  // Titles only: the template records *what* the steps are, not how far this
  // one task got.
  subtasks: task.subtasks.map(({ id, title }) => ({ id, title })),
});

/** "3 steps" — the only thing worth saying about a template in a list row. */
export const describeChecklist = (template: TTemplate): string => {
  const count = template.subtasks.length;
  if (count === 0) return "No checklist";
  return count === 1 ? "1 step" : `${count} steps`;
};

/** See `withSubtasksArray` in `api/tasks.ts` — the same pre-migration guard. */
const withSubtasksArray = <T extends { subtasks?: TTemplateSubtask[] }>(
  row: T,
): T => (Array.isArray(row.subtasks) ? row : { ...row, subtasks: [] });

export const getTemplates = async (supabase: SupabaseClient<Database>) => {
  const { data, error } = await supabase
    .from("repeat_task_templates")
    .select("*")
    .order("created_at");

  if (error) throw error;
  return (camelCase(data) as TTemplate[]).map(withSubtasksArray);
};

export type TCreateTemplate = {
  alarmTime?: string | null;
  goalId?: string | null;
  listId?: string | null;
  priority: ETaskPriority;
  /**
   * The column has no default, so this is not optional in practice: pass a cron
   * expression for a repeat task or `null` for a task template.
   */
  schedule?: string | null;
  subtasks?: TTemplateSubtask[];
  title: string;
};

export const createTemplate = async (
  supabase: SupabaseClient<Database>,
  template: TCreateTemplate,
) => {
  const { data, error } = await supabase
    .from("repeat_task_templates")
    .insert(snakeCase(template) as TablesInsert<"repeat_task_templates">)
    .select()
    .single();

  if (error) throw error;
  return withSubtasksArray(camelCase(data) as TTemplate);
};

export type TUpdateTemplate = {
  id: string;
  alarmTime?: string | null;
  goalId?: string | null;
  listId?: string | null;
  priority?: ETaskPriority;
  /** Setting this to null turns a repeat task into a plain task template. */
  schedule?: string | null;
  subtasks?: TTemplateSubtask[];
  title?: string;
};

export const updateTemplate = async (
  supabase: SupabaseClient<Database>,
  { id, ...diff }: TUpdateTemplate,
) => {
  const { data, error } = await supabase
    .from("repeat_task_templates")
    .update(snakeCase(diff) as TablesUpdate<"repeat_task_templates">)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return withSubtasksArray(camelCase(data) as TTemplate);
};

export const deleteTemplate = async (
  supabase: SupabaseClient<Database>,
  id: string,
) => {
  const { error } = await supabase
    .from("repeat_task_templates")
    .delete()
    .eq("id", id);

  if (error) throw error;
};
