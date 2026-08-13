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
 * A subtask is a lightweight checklist item stored inside its parent's
 * `subtasks` jsonb array — never its own row. Ids are minted client-side and
 * are only unique within the array. See `docs/features.md` (Tasks → Subtasks)
 * for the model and its accepted last-write-wins tradeoff.
 *
 * Complete or incomplete, and nothing else (DEX-153). The field is `done` rather
 * than `isComplete` deliberately: `changeCase` converts keys `deep: true`, so a
 * two-word key would be stored `is_complete` by the app while the MCP server —
 * which writes this array as raw jsonb — would store `isComplete`.
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

// Re-exported so `@/api/tasks` stays the one import site for task types, but the
// enums themselves live in import-free leaf modules that the Deno MCP server can
// also load — this file can't be, since it pulls in `@supabase/supabase-js`.
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
 * Guarantees `subtasks` is an array of `{id, title, done}`. The row shape is an
 * unchecked cast, and the app and the database deploy independently — a bundle
 * that reaches users before the migration runs gets rows with no `subtasks`
 * column at all, and every consumer here dereferences it without guarding.
 * Mirrors the `alarmTime` `== null` handling in `TaskCard` (DEX-48).
 *
 * It also fills `done` from a legacy `status` (DEX-153). The backfill migration
 * converts what is stored, but the reverse skew is the one that outlives it: an
 * app bundle predating this change keeps writing `status` until its user
 * updates. Coerce, never reject — the terminal statuses map to `done`.
 *
 * Exported for `api/search.ts`, whose task results come back as jsonb from the
 * `search_entries` RPC rather than through `getTasks` — same rows, same guard.
 */
export const withSubtasksArray = <T extends { subtasks?: TSubtask[] }>(
  row: T,
): T =>
  Array.isArray(row.subtasks)
    ? { ...row, subtasks: row.subtasks.map(withDone) }
    : { ...row, subtasks: [] };

/**
 * One stored item, given a `done`. Reads the legacy `status` through
 * `isCompletionStatus` so "terminal" means the same thing it does everywhere
 * else, rather than a second list of which statuses count as finished.
 *
 * **A `status` present at all wins over a `done` beside it.** Nothing written
 * since DEX-153 emits one — this strips it, and no other write path adds it —
 * so its presence identifies a pre-DEX-153 writer. Those clients build their
 * write by spreading the item they read, which *post*-backfill already carries
 * `done`, so they emit both: a fresh `status` and the stale `done` they never
 * touched. Preferring `done` there would drop the user's action and could leave
 * an unchecked checklist under a closed parent — the one state the sweep exists
 * to prevent.
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
  url: task.url,
});

/**
 * Builds the `createTask` input for promoting a subtask into a real task. The
 * new task inherits the parent's *context* — where it lives, when it's due, and
 * what it links to — but not its `alarmTime`: an alarm is a deliberate per-task
 * commitment, and silently cloning it onto a checklist item would ring an alarm
 * the user never set. That side effect is what sets `alarmTime` apart; a link
 * just sits there, so it travels with the rest of the context. The subtask keeps
 * its own title.
 *
 * This is the one place the two-state checklist meets the five-state task
 * (DEX-153): a checked subtask becomes a `DONE` task, an unchecked one a `TODO`.
 * The three other statuses are a task's to acquire — promotion is the moment an
 * item earns them, so it can't have arrived carrying one.
 *
 * Promotion is two non-atomic writes (create the task, then update the parent
 * minus the element); a crash between them leaves a duplicate, not data loss.
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

/**
 * The array with one subtask removed — the second half of promotion, and the
 * delete action. Array-in/array-out like its siblings, so callers holding a
 * pending draft array (not a stored `TTask`) can use it too.
 */
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
 * Whether an *open* task links to this template — the one predicate behind "can
 * this repeat still fire?". Recurrence spawns from *completing* a linked task,
 * so only a todo/in-progress one can ever fire it; since a template's link now
 * records provenance for stamped tasks too, its links may all be long since
 * checked off, which leaves the repeat stalled rather than live.
 *
 * Any age, so this still deliberately bypasses the canonical query's
 * recent-window filter: an occurrence scheduled a year out counts.
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
