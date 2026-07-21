import { SupabaseClient } from "@supabase/supabase-js";

import { camelCase, snakeCase } from "@/utils/changeCase";
import { Database, TablesInsert, TablesUpdate } from "@/types/database.types";

import { ETaskPriority } from "./tasks";

/**
 * A template's checklist item. Unlike a task's subtask it carries no `status` —
 * a template is a blueprint, not state; each generated occurrence materializes
 * its own copy at the open status (see `subtasksFromTemplate`).
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
  schedule: string;
  subtasks: TTemplateSubtask[];
  title: string;
  userId: string;
};

export const getTemplates = async (supabase: SupabaseClient<Database>) => {
  const { data, error } = await supabase
    .from("repeat_task_templates")
    .select("*")
    .order("created_at");

  if (error) throw error;
  return camelCase(data) as TTemplate[];
};

export type TCreateTemplate = {
  alarmTime?: string | null;
  goalId?: string | null;
  listId?: string | null;
  priority: ETaskPriority;
  schedule?: string;
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
  return camelCase(data) as TTemplate;
};

export type TUpdateTemplate = {
  id: string;
  alarmTime?: string | null;
  goalId?: string | null;
  listId?: string | null;
  priority?: ETaskPriority;
  schedule?: string;
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
  return camelCase(data) as TTemplate;
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
