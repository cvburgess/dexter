import { SupabaseClient } from "@supabase/supabase-js";

import { camelCase, snakeCase } from "@/utils/changeCase";
import { makeSubtaskId, withFreshIds } from "@/utils/subtasks";
import { ETaskPriority } from "@/utils/taskPriority";
import {
  ETaskStatus,
  isCompletionStatus,
  OPEN_TASK_STATUSES,
} from "@/utils/taskStatus";
import { Database, TablesInsert, TablesUpdate } from "@/types/database.types";

import { applyFilters, TQueryFilter } from "./applyFilters";

/**
 * Lives in the parent's `subtasks` jsonb, never its own row (docs/features.md).
 * One-word `done` (DEX-153): `changeCase` deep-converts keys, raw MCP jsonb doesn't.
 */
export type TSubtask = {
  id: string;
  title: string;
  done: boolean;
};

export type TTask = {
  id: string;
  alarmTime: string | null;
  dueOn: string | null;
  goalId: string | null;
  listId: string | null;
  priority: ETaskPriority;
  scheduledFor: string | null;
  status: ETaskStatus;
  subtasks: TSubtask[];
  templateId: string | null;
  title: string;
  /** Optional link the task is about. Stored normalized; see `utils/taskUrl`. */
  url: string | null;
};

// Re-exported so `@/api/tasks` stays the one import site; the enums live in
// import-free leaf modules the Deno MCP server can also load — this file can't be.
export { ETaskPriority, ETaskStatus };

export const getTasks = async (
  supabase: SupabaseClient<Database>,
  filters: TQueryFilter[] = [],
) => {
  const query = applyFilters(supabase.from("tasks").select("*"), filters)
    .order("status")
    .order("priority")
    .order("due_on");

  const { data, error } = await query;

  if (error) throw error;
  return (camelCase(data) as TTask[]).map(withSubtasksArray);
};

/**
 * The row cast is unchecked and old bundles see rows with no `subtasks` column
 * (DEX-48) or legacy `status` items — coerce, never reject (DEX-153).
 */
export const withSubtasksArray = <T extends { subtasks?: TSubtask[] }>(
  row: T,
): T =>
  Array.isArray(row.subtasks)
    ? { ...row, subtasks: row.subtasks.map(withDone) }
    : { ...row, subtasks: [] };

/**
 * A `status` present at all marks a pre-DEX-153 writer and wins over the stale
 * `done` spread beside it — preferring `done` would drop the user's action.
 */
const withDone = (subtask: TSubtask): TSubtask => {
  const legacy = subtask as TSubtask & { status?: ETaskStatus };

  if (legacy.status === undefined) {
    return typeof legacy.done === "boolean"
      ? subtask
      : { ...subtask, done: false };
  }

  // Destructured out rather than spread over: the next write rewrites the whole
  // array, so carrying the dead key along would re-persist it indefinitely.
  const { status, ...rest } = legacy;
  return { ...rest, done: isCompletionStatus(status) };
};

export type TCreateTask = {
  alarmTime?: string | null;
  dueOn?: string | null;
  goalId?: string | null;
  listId?: string | null;
  priority?: ETaskPriority;
  scheduledFor?: string | null;
  status?: ETaskStatus;
  subtasks?: TSubtask[];
  templateId?: string | null;
  title: string;
  url?: string | null;
};

/**
 * `templateId` is deliberately dropped — a duplicate is an independent one-off,
 * so only the original drives its repeat (DEX-21). Subtasks get fresh ids.
 */
export const duplicateTaskInput = (task: TTask): TCreateTask => ({
  title: task.title,
  alarmTime: task.alarmTime,
  dueOn: task.dueOn,
  goalId: task.goalId,
  listId: task.listId,
  priority: task.priority,
  scheduledFor: task.scheduledFor,
  status: task.status,
  subtasks: withFreshIds(task.subtasks),
  url: task.url,
});

/**
 * Never inherits the alarm — cloning one would ring an alarm the user never set.
 * The two writes aren't atomic; a crash leaves a duplicate, not loss (DEX-153).
 */
export const promoteSubtaskInput = (
  parent: TTask,
  subtask: TSubtask,
): TCreateTask => ({
  title: subtask.title,
  status: subtask.done ? ETaskStatus.DONE : ETaskStatus.TODO,
  alarmTime: null,
  dueOn: parent.dueOn,
  goalId: parent.goalId,
  listId: parent.listId,
  priority: parent.priority,
  scheduledFor: parent.scheduledFor,
  url: parent.url,
});

/** Array-in/array-out so callers holding a pending draft array can use it too. */
export const removeSubtask = (
  subtasks: TSubtask[],
  subtaskId: string,
): TSubtask[] => subtasks.filter(({ id }) => id !== subtaskId);

/** Appends an empty-titled, unchecked subtask, ready for inline entry. */
export const appendSubtask = (subtasks: TSubtask[]): TSubtask[] => [
  ...subtasks,
  { id: makeSubtaskId(), title: "", done: false },
];

export const createTask = async (
  supabase: SupabaseClient<Database>,
  task: TCreateTask,
) => {
  const { data, error } = await supabase
    .from("tasks")
    .insert(snakeCase(task) as TablesInsert<"tasks">)
    .select();

  if (error) throw error;
  return (camelCase(data) as TTask[]).map(withSubtasksArray);
};

export type TUpdateTask = {
  id: string;
  alarmTime?: string | null;
  dueOn?: string | null;
  goalId?: string | null;
  listId?: string | null;
  priority?: ETaskPriority;
  scheduledFor?: string | null;
  status?: ETaskStatus;
  subtasks?: TSubtask[];
  templateId?: string | null;
  title?: string;
  url?: string | null;
};

export const updateTask = async (
  supabase: SupabaseClient<Database>,
  { id, ...diff }: TUpdateTask,
) => {
  const { data, error } = await supabase
    .from("tasks")
    .update(snakeCase(diff) as TablesUpdate<"tasks">)
    .eq("id", id)
    .select();

  if (error) throw error;
  return (camelCase(data) as TTask[]).map(withSubtasksArray);
};

export const updateTasks = async (
  supabase: SupabaseClient<Database>,
  tasks: TUpdateTask[],
) => {
  const { data, error } = await supabase
    .from("tasks")
    .upsert(tasks.map((task) => snakeCase(task) as TablesUpdate<"tasks">))
    .select();

  if (error) throw error;
  return (camelCase(data) as TTask[]).map(withSubtasksArray);
};

/**
 * Recurrence fires on *completing* an open linked task, and links also record
 * provenance — all-closed means stalled. No recent-window filter: any age counts.
 */
export const hasOpenTaskForTemplate = async (
  supabase: SupabaseClient<Database>,
  templateId: string,
) => {
  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("template_id", templateId)
    .in("status", OPEN_TASK_STATUSES)
    .limit(1);

  if (error) throw error;
  return data.length > 0;
};

export const deleteTask = async (
  supabase: SupabaseClient<Database>,
  id: string,
) => {
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) throw error;
};
