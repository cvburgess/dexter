import { SupabaseClient } from "@supabase/supabase-js";

import { camelCase, snakeCase } from "@/utils/changeCase";
import { Database, TablesInsert, TablesUpdate } from "@/types/database.types";

import { applyFilters, TQueryFilter } from "./applyFilters";

export type TTask = {
  id: string;
  alarmTime: string | null;
  dueOn: string | null;
  goalId: string | null;
  listId: string | null;
  priority: ETaskPriority;
  scheduledFor: string | null;
  status: ETaskStatus;
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
  templateId?: string | null;
  title: string;
};

/**
 * Builds the `createTask` input for duplicating an existing task: copies every
 * copyable field (including `status`) and omits the DB-generated `id`. The
 * `templateId` is intentionally dropped — a duplicate is an independent one-off
 * task, so only the original drives its repeat schedule (DEX-21).
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
});

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
