import { Temporal } from "@js-temporal/polyfill";

import { TTask } from "@/api/tasks";
import { isCompletionStatus } from "@/utils/taskStatus";

export type TFilterId =
 | "none"
 | "overdue"
 | "dueSoon"
 | "leftBehind"
 | "unscheduled";

const DUE_SOON_WINDOW_DAYS = 13;

// Defined in import-free `utils/taskStatus` so the Deno MCP server shares the
// one predicate; re-exported here, where the app's task filtering lives.
export { isCompletionStatus };

const isIncomplete = (task: TTask): boolean => !isCompletionStatus(task.status);

/** Due date set and strictly before `todayIso` — the "Overdue" preset's predicate. */
const isOverdue = (task: TTask, todayIso: string): boolean =>
 task.dueOn !== null && task.dueOn < todayIso;

/** Scheduled for a day strictly before `todayIso` — the "Left Behind" preset's predicate. */
const isLeftBehind = (task: TTask, todayIso: string): boolean =>
 task.scheduledFor !== null && task.scheduledFor < todayIso;

/** Tasks scheduled for `date`, any status — the Today list's contents. */
export function selectTasksForDate(
 tasks: TTask[],
 date: Temporal.PlainDate,
): TTask[] {
 const iso = date.toString();
 return tasks.filter((task) => task.scheduledFor === iso);
}

/**
 * Tasks for `date` nobody has closed out — the evening Open tasks step
 * (DEX-146). Uses the shared `isCompletionStatus`: "still open" is one decision.
 */
export function selectOpenTasksForDate(
 tasks: TTask[],
 date: Temporal.PlainDate,
): TTask[] {
 return selectTasksForDate(tasks, date).filter(isIncomplete);
}

/**
 * The Review step's list (DEX-148) — exact complement of `selectOpenTasksForDate`.
 * Scope is `scheduledFor`, not a completion timestamp: tasks have no `completedAt`.
 */
export function selectCompletedTasksForDate(
 tasks: TTask[],
 date: Temporal.PlainDate,
): TTask[] {
 return selectTasksForDate(tasks, date).filter((task) =>
  isCompletionStatus(task.status),
 );
}

/**
 * Backlog base scope (DEX-57): incomplete tasks not already on screen. Takes a
 * day array (one on Today, seven on Week) so no separate week variant (DEX-96).
 */
export function selectBacklogTasks(
 tasks: TTask[],
 daysOnScreen: Temporal.PlainDate[],
): TTask[] {
 const shown = new Set(daysOnScreen.map((day) => day.toString()));
 return tasks.filter(
  (task) =>
   isIncomplete(task) &&
   (task.scheduledFor === null || !shown.has(task.scheduledFor)),
 );
}

/**
 * The Filter-menu preset over an already-scoped array (DEX-57). ISO `YYYY-MM-DD`
 * strings compare correctly as strings — no Temporal parsing per task.
 */
export function filterTasks(
 tasks: TTask[],
 filterId: TFilterId,
 today: Temporal.PlainDate,
): TTask[] {
 const todayIso = today.toString();

 switch (filterId) {
  case "none":
   return tasks;
  case "overdue":
   return tasks.filter((task) => isOverdue(task, todayIso));
  case "dueSoon": {
   const cutoffIso = today.add({ days: DUE_SOON_WINDOW_DAYS }).toString();
   return tasks.filter(
    (task) =>
     task.dueOn !== null && task.dueOn >= todayIso && task.dueOn <= cutoffIso,
   );
  }
  case "leftBehind":
   return tasks.filter((task) => isLeftBehind(task, todayIso));
  case "unscheduled":
   return tasks.filter((task) => task.scheduledFor === null);
 }
}

/**
 * Attention-dot preset (DEX-58); overdue outranks leftBehind. Anchored to today
 * with a strict `<`; must skip completed tasks — the presets themselves don't.
 */
export function backlogAttentionFilter(
 tasks: TTask[],
 today: Temporal.PlainDate,
): TFilterId | null {
 const todayIso = today.toString();
 let hasLeftBehind = false;
 for (const task of tasks) {
  if (!isIncomplete(task)) continue;
  // Any overdue task wins outright, whatever the array order.
  if (isOverdue(task, todayIso)) return "overdue";
  if (isLeftBehind(task, todayIso)) hasLeftBehind = true;
 }
 return hasLeftBehind ? "leftBehind" : null;
}

/** What the ritual Backlog step's hero counts (DEX-141). */
export type TBacklogCounts = {
 leftBehind: number;
 overdue: number;
 dueSoon: number;
};

/**
 * The hero's reading order and `defaultBacklogFilter`'s walk — one product
 * decision, exported so the hero can't restate it beside its labels.
 */
export const BACKLOG_COUNT_ORDER = [
 "leftBehind",
 "overdue",
 "dueSoon",
] as const satisfies readonly (keyof TBacklogCounts & TFilterId)[];

/**
 * Hero figures (DEX-141) over a `selectBacklogTasks`-scoped array, built from
 * `filterTasks` so a count can't drift from its preset. Buckets overlap on purpose.
 */
export function backlogCounts(
 tasks: TTask[],
 today: Temporal.PlainDate,
): TBacklogCounts {
 return {
  leftBehind: filterTasks(tasks, "leftBehind", today).length,
  overdue: filterTasks(tasks, "overdue", today).length,
  dueSoon: filterTasks(tasks, "dueSoon", today).length,
 };
}

/** A filter preset the menu suffixes with a count (DEX-126) — every one but "none". */
export type TCountedFilterId = Exclude<TFilterId, "none">;

/**
 * Per-preset figures for the Filter menu's option titles (DEX-126) over a
 * `selectBacklogTasks`-scoped array. `backlogCounts` plus Unscheduled, so a
 * menu figure and the hero's can't drift apart.
 */
export function filterMenuCounts(
 tasks: TTask[],
 today: Temporal.PlainDate,
): Record<TCountedFilterId, number> {
 return {
  ...backlogCounts(tasks, today),
  unscheduled: filterTasks(tasks, "unscheduled", today).length,
 };
}

/**
 * First non-zero count in the hero's reading order. Deliberately not
 * `backlogAttentionFilter` (DEX-58) — the dot ranks Overdue first, skips Due Soon.
 */
export function defaultBacklogFilter(counts: TBacklogCounts): TFilterId {
 return BACKLOG_COUNT_ORDER.find((id) => counts[id] > 0) ?? "none";
}

/** Whether a preset is one of the three the hero counts. */
const isCountedFilter = (id: TFilterId): id is keyof TBacklogCounts =>
 (BACKLOG_COUNT_ORDER as readonly TFilterId[]).includes(id);

/**
 * `current` while it still has tasks, else the next non-empty bucket in the
 * hero's order — only emptiness moves the filter, and detour presets stay put.
 */
export function nextBacklogFilter(
 current: TFilterId,
 counts: TBacklogCounts,
): TFilterId {
 if (!isCountedFilter(current) || counts[current] > 0) return current;
 return defaultBacklogFilter(counts);
}
