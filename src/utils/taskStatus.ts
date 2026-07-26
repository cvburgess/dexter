/**
 * The task status enum and its terminal-status predicate, shared by the Expo app
 * (`@/utils/taskStatus`) and the Deno MCP server (`@src/utils/taskStatus.ts`) —
 * the same arrangement `repeatSchedule.ts` and `subtasks.ts` use.
 *
 * Keep this file import-free. Deno requires explicit `.ts` extensions on relative
 * imports while Metro/tsc forbid them, so pulling in another `src/` module here
 * would break one of the two runtimes. That constraint is the whole reason this
 * lives outside `api/tasks.ts`, which imports `@supabase/supabase-js` and friends
 * and so cannot be loaded from Deno at all.
 *
 * Before DEX-68 the server kept its own `TASK_STATUS_*` constants and a copy of
 * `isCompletionStatus`. Sharing them means a status can no longer be added to one
 * side and forgotten on the other — a drift whose failure mode was silent, since
 * an unrecognized status made the server's stored-row parse fail, which it reads
 * as "no subtasks" and skips the completion sweep.
 */

/**
 * Persisted directly as `tasks.status smallint` — the numeric values are stored
 * data, not just a TS detail. Append new members only; reordering renumbers every
 * existing row.
 *
 * Note that the numbering doubles as sort order: task queries `.order("status")`
 * on the raw smallint, so appending has so far kept the terminal statuses at the
 * bottom by luck. Adding an *open* status would be forced to the end by the
 * append-only rule and would sort below the closed-out ones — at which point the
 * two constraints collide and display order needs its own explicit table.
 */
export enum ETaskStatus {
  IN_PROGRESS,
  TODO,
  DONE,
  WONT_DO,
  DELEGATED,
}

/**
 * The terminal statuses — a task nobody is going to work on further, whether it
 * was finished, abandoned, or handed to someone else (DEX-68). The single place
 * that classification lives: card styling, the Backlog scope, alarm
 * reconciliation, the subtask sweep, and both the app's and the server's
 * recurring-task logic all read it, so a status added here becomes terminal
 * everywhere at once.
 *
 * Accepts `number` so the MCP server can pass a raw column value straight in, and
 * narrows on the way out so callers like `withSubtaskSweep` get a status proven
 * non-null without a second check.
 */
export const isCompletionStatus = (
  status: ETaskStatus | number | null | undefined,
): status is ETaskStatus.DONE | ETaskStatus.WONT_DO | ETaskStatus.DELEGATED =>
  status === ETaskStatus.DONE ||
  status === ETaskStatus.WONT_DO ||
  status === ETaskStatus.DELEGATED;
