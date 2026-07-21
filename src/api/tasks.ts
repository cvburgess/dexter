import { SupabaseClient } from "@supabase/supabase-js";

import { camelCase, snakeCase } from "@/utils/changeCase";
import { makeSubtaskId, withFreshIds } from "@/utils/subtasks";
import { Database, TablesInsert, TablesUpdate } from "@/types/database.types";

import { applyFilters, TQueryFilter } from "./applyFilters";

/**
 * A subtask is a lightweight checklist item stored inside its parent's
 * `subtasks` jsonb array — never its own row. Ids are minted client-side and
 * are only unique within the array. See `docs/backend.md` for the model and its
 * accepted last-write-wins tradeoff.
 */
export type TSubtask = {
  id: string;
  title: string;
  status: ETaskStatus;
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
};

export enum ETaskPriority {
  IMPORTANT_AND_URGENT,
  URGENT,
  IMPORTANT,
  NEITHER,
  UNPRIORITIZED,
}

export enum ETaskStatus {
  IN_PROGRESS,
  TODO,
  DONE,
  WONT_DO,
}

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
  return camelCase(data) as TTask[];
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
};

/**
 * Builds the `createTask` input for duplicating an existing task: copies every
 * copyable field (including `status`) and omits the DB-generated `id`. The
 * `templateId` is intentionally dropped — a duplicate is an independent one-off
 * task, so only the original drives its repeat schedule (DEX-21). Subtasks are
 * copied with fresh ids so the two checklists can diverge.
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
});

/**
 * Builds the `createTask` input for promoting a subtask into a real task. The
 * new task inherits the parent's *context* — where it lives and when it's due —
 * but not its `alarmTime`: an alarm is a deliberate per-task commitment, and
 * silently cloning it onto a checklist item would ring an alarm the user never
 * set. The subtask keeps its own title and status.
 *
 * Promotion is two non-atomic writes (create the task, then update the parent
 * minus the element); a crash between them leaves a duplicate, not data loss.
 */
export const promoteSubtaskInput = (
  parent: TTask,
  subtask: TSubtask,
): TCreateTask => ({
  title: subtask.title,
  status: subtask.status,
  alarmTime: null,
  dueOn: parent.dueOn,
  goalId: parent.goalId,
  listId: parent.listId,
  priority: parent.priority,
  scheduledFor: parent.scheduledFor,
});

/**
 * The array with one subtask removed — the second half of promotion, and the
 * delete action. Array-in/array-out like its siblings, so callers holding a
 * pending draft array (not a stored `TTask`) can use it too.
 */
export const removeSubtask = (
  subtasks: TSubtask[],
  subtaskId: string,
): TSubtask[] => subtasks.filter(({ id }) => id !== subtaskId);

/** Appends an empty-titled subtask, ready for inline entry. */
export const appendSubtask = (subtasks: TSubtask[]): TSubtask[] => [
  ...subtasks,
  { id: makeSubtaskId(), title: "", status: ETaskStatus.TODO },
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
  return camelCase(data) as TTask[];
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
  return camelCase(data) as TTask[];
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
  return camelCase(data) as TTask[];
};

export const deleteTask = async (
  supabase: SupabaseClient<Database>,
  id: string,
) => {
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) throw error;
};
