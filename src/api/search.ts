import { SupabaseClient } from "@supabase/supabase-js";

import { TTask, withSubtasksArray } from "@/api/tasks";
import { camelCase } from "@/utils/changeCase";
import { Database } from "@/types/database.types";

/**
 * One hit from the `search_entries` RPC (DEX-47), discriminated on where it came
 * from. A task carries its whole row so the results list can render the same
 * `TaskCard` the Today list does; notes and journal entries carry the full
 * matched text, not a server-built excerpt, so the client can compute the
 * highlight offsets itself (see `utils/searchHighlight.ts`).
 */
export type TSearchResult =
  | { kind: "task"; task: TTask }
  | { kind: "note"; date: string; content: string }
  | { kind: "journal"; date: string; prompt: string; content: string };

/** The RPC's row shape, after `camelCase` has walked it. */
type TSearchRow = {
  kind: string;
  entryDate: string | null;
  task: unknown;
  prompt: string | null;
  content: string | null;
};

/**
 * Narrows a raw row to the union, dropping anything malformed rather than
 * letting a half-built result reach the list. Each branch requires exactly the
 * fields its `kind` promises: a note with no date could not be navigated to, and
 * a task with no row could not be rendered.
 */
const rowToResult = (row: TSearchRow): TSearchResult | null => {
  if (row.kind === "task") {
    // `task` is jsonb, so `camelCase`'s deep walk has already renamed its keys
    // (scheduled_for → scheduledFor). Same rows `getTasks` returns, so they need
    // the same subtasks guard.
    return row.task
      ? { kind: "task", task: withSubtasksArray(row.task as TTask) }
      : null;
  }

  if (row.kind === "note") {
    return row.entryDate !== null && row.content !== null
      ? { kind: "note", date: row.entryDate, content: row.content }
      : null;
  }

  if (row.kind === "journal") {
    return row.entryDate !== null
      ? {
          kind: "journal",
          date: row.entryDate,
          // A prompt with no response (or vice versa) still matches on the half
          // that has text, so neither is required — only the date is.
          prompt: row.prompt ?? "",
          content: row.content ?? "",
        }
      : null;
  }

  return null;
};

/**
 * Searches task titles (including subtask titles), note content, and journal
 * prompts/responses for `query`.
 *
 * The matching lives entirely in the `search_entries` RPC — term splitting, LIKE
 * escaping, and per-user scoping (the function is `security invoker`, so RLS
 * scopes it). Passing `query` through untouched is deliberate: escaping it here
 * would double-escape what the function already handles.
 */
export const searchEntries = async (
  supabase: SupabaseClient<Database>,
  query: string,
): Promise<TSearchResult[]> => {
  const { data, error } = await supabase.rpc("search_entries", { query });

  if (error) throw error;
  if (!data) return [];

  return (camelCase(data) as TSearchRow[])
    .map(rowToResult)
    .filter((result): result is TSearchResult => result !== null);
};
