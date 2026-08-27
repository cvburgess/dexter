import { SupabaseClient } from "@supabase/supabase-js";

import { TTask, withSubtasksArray } from "@/api/tasks";
import { camelCase } from "@/utils/changeCase";
import { Database } from "@/types/database.types";

// One hit from the search_entries RPC (DEX-47). A task carries its whole
// row; notes/journals carry full text so the client computes highlights.
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

// Drops anything malformed rather than letting a half-built result reach the
// list — a note with no date can't be navigated to, a task with no row rendered.
const rowToResult = (row: TSearchRow): TSearchResult | null => {
  if (row.kind === "task") {
    // camelCase's deep walk already renamed keys; same rows getTasks
    // returns, so they need the same subtasks guard.
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
          // Only the date is required — the response is always present since
          // it's the only field search_entries matches on.
          prompt: row.prompt ?? "",
          content: row.content ?? "",
        }
      : null;
  }

  return null;
};

// Matching lives entirely in the RPC (term splitting, LIKE escaping,
// security invoker); passing query untouched avoids double-escaping.
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
