/**
 * The task priority enum, shared by the Expo app (`@/utils/taskPriority`) and
 * the Deno MCP server (`@src/utils/taskPriority.ts`) — the same arrangement
 * `taskStatus.ts`, `repeatSchedule.ts`, and `subtasks.ts` use.
 *
 * Keep this file import-free. Deno requires explicit `.ts` extensions on relative
 * imports while Metro/tsc forbid them, so pulling in another `src/` module here
 * would break one of the two runtimes. That constraint is the whole reason this
 * lives outside `api/tasks.ts`, which imports `@supabase/supabase-js` and friends
 * and so cannot be loaded from Deno at all.
 *
 * Before DEX-137 the server bounded priority with a hand-written
 * `z.number().int().min(0).max(4)` because it could not reach the enum. Sharing
 * it means the bound can no longer fall behind a newly added priority.
 */

/**
 * Persisted directly as `tasks.priority smallint` and
 * `repeat_task_templates.priority smallint` — the numeric values are stored
 * data, not just a TS detail. Append new members only; reordering renumbers
 * every existing row.
 *
 * The numbering is an Eisenhower matrix and doubles as sort order: task queries
 * `.order("priority")` on the raw smallint, so *lower is more urgent* — the
 * inverse of the usual convention. `UNPRIORITIZED` is the column default and
 * means "never chosen", which is distinct from `NEITHER` ("explicitly neither
 * important nor urgent"); it sorts last for that reason.
 */
export enum ETaskPriority {
  IMPORTANT_AND_URGENT,
  URGENT,
  IMPORTANT,
  NEITHER,
  UNPRIORITIZED,
}
