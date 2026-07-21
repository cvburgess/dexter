import { TTask } from "@/api/tasks";

/**
 * The canonical task ordering: status, then priority, then due date with
 * undated tasks last.
 *
 * This mirrors `getTasks`' server-side `.order("status").order("priority")
 * .order("due_on")` — Postgres sorts ASC with NULLS LAST, hence the null
 * handling below. It exists client-side because `useTasks`' update mutation
 * writes optimistically (DEX-77): merging a diff into the cached array leaves
 * the task at its old index, so a status or priority change would render in
 * the wrong position until the refetch landed and then visibly jump. Applying
 * the same sort to both the optimistic write and the fetch response means the
 * two can't disagree — the client sort is authoritative, so a divergence in
 * how the server breaks ties can't reintroduce the jump.
 *
 * Returns a new array; does not mutate `tasks`.
 */
export function sortTasks(tasks: TTask[]): TTask[] {
  return [...tasks].sort(
    (a, b) =>
      a.status - b.status ||
      a.priority - b.priority ||
      compareNullableAsc(a.dueOn, b.dueOn),
  );
}

/** ISO date strings compare correctly as plain strings; nulls sort last, matching Postgres ASC. */
function compareNullableAsc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}
