import { Temporal } from "@js-temporal/polyfill";

import { TTask } from "@/api/tasks";
import { isCompletionStatus } from "@/utils/taskStatus";

export type TFilterId =
  "none" | "overdue" | "dueSoon" | "leftBehind" | "unscheduled";

const DUE_SOON_WINDOW_DAYS = 13;

// Defined in the import-free `utils/taskStatus` so the Deno MCP server shares the
// one predicate; re-exported here because this module is where the app's task
// filtering lives and every existing call site imports it from here.
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
 * Tasks scheduled for `date` that nobody has closed out — the evening ritual's
 * Open tasks step (DEX-146).
 *
 * `selectTasksForDate` narrowed by the same `isIncomplete` the backlog scope
 * uses, rather than a `status` test of its own: "still open" is one decision,
 * and it lives in `utils/taskStatus`'s `isCompletionStatus` (shared with the
 * Deno MCP server), so a status added there becomes open-or-closed everywhere at
 * once.
 */
export function selectOpenTasksForDate(
  tasks: TTask[],
  date: Temporal.PlainDate,
): TTask[] {
  return selectTasksForDate(tasks, date).filter(isIncomplete);
}

/**
 * Incomplete tasks that are unscheduled or scheduled for a day *not* already on
 * screen — the Backlog drawer's base scope (on-device equivalent of the former
 * `notScheduledForDateFilters` server query, DEX-57).
 *
 * `daysOnScreen` is however many days the host is showing: one on the Today tab,
 * seven on the Week tab (DEX-96). The rule is the same either way — offer what
 * isn't already in front of the user — so this takes a cardinality rather than a
 * mode, and there is no separate week variant to keep in step with this one.
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
 * Applies the Backlog's Filter-menu preset on top of an already-scoped task
 * array (on-device equivalent of the former `taskFilters` server presets,
 * DEX-57). `"none"` is a no-op. `dueOn`/`scheduledFor` are ISO `YYYY-MM-DD`
 * strings, which compare correctly with plain string operators — no Temporal
 * parsing needed per task.
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
          task.dueOn !== null &&
          task.dueOn >= todayIso &&
          task.dueOn <= cutoffIso,
      );
    }
    case "leftBehind":
      return tasks.filter((task) => isLeftBehind(task, todayIso));
    case "unscheduled":
      return tasks.filter((task) => task.scheduledFor === null);
  }
}

/**
 * The Backlog Filter preset the attention dot maps to (DEX-58), or `null` when
 * no *incomplete* task is overdue or left behind as of `today`. `"overdue"`
 * wins when both kinds exist (product decision: overdue is more time-sensitive).
 * The dot itself is just `backlogAttentionFilter(...) !== null`, and tapping
 * Backlog pre-applies the returned preset in the drawer.
 *
 * Anchored to today, not the viewed day, since it signals "you have stragglers"
 * regardless of which day is on screen. Uses the same strict `< today` boundary
 * as the drawer's Overdue / Left Behind presets (a task due today is not yet
 * overdue). The status guard matters: `filterTasks`'s presets don't check
 * completion themselves (the drawer pre-scopes to incomplete via
 * `selectBacklogTasks`), so a completed past-due task must not light the dot.
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
 * The order the Backlog step's hero states its three counts in, which is also
 * the order `defaultBacklogFilter` walks them.
 *
 * Exported so the hero maps over this rather than restating the order beside
 * its labels: the reading order and the filter priority are one product
 * decision, and a second copy is a copy that can be reordered on its own.
 */
export const BACKLOG_COUNT_ORDER = [
  "leftBehind",
  "overdue",
  "dueSoon",
] as const satisfies readonly (keyof TBacklogCounts & TFilterId)[];

/**
 * The three figures the ritual Backlog step's hero states (DEX-141), over an
 * array already scoped by `selectBacklogTasks` — which is what excludes
 * completed tasks and the day the ritual is on, since the presets below don't
 * check either themselves.
 *
 * Built from `filterTasks` rather than from its own predicates so a count can
 * never drift from the Filter preset it labels: the hero says "3 tasks left
 * behind" directly above a menu whose "Left Behind" entry has to show those
 * same three.
 *
 * The buckets deliberately overlap — a task scheduled last week *and* due last
 * week is counted in both `leftBehind` and `overdue`, because each figure
 * answers for its own preset rather than for a share of one total.
 *
 * Anchored to `today`, not the ritual's date, for the same reason: the drawer
 * beneath the hero filters against today whichever day the header is on.
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

/**
 * The Filter preset the ritual Backlog step opens on: the first non-zero count
 * in the order the hero reads, Left Behind → Overdue → Due Soon, or `"none"`
 * when nothing needs attention.
 *
 * Deliberately not `backlogAttentionFilter`, which answers a different question
 * for the Today tab's attention dot (DEX-58) — that one puts Overdue first and
 * ignores Due Soon entirely, because a dot has to pick the single most
 * time-sensitive thing, where this step is walking the reader down a list it
 * has already shown them in full.
 */
export function defaultBacklogFilter(counts: TBacklogCounts): TFilterId {
  return BACKLOG_COUNT_ORDER.find((id) => counts[id] > 0) ?? "none";
}

/** Whether a preset is one of the three the hero counts. */
const isCountedFilter = (id: TFilterId): id is keyof TBacklogCounts =>
  (BACKLOG_COUNT_ORDER as readonly TFilterId[]).includes(id);

/**
 * The preset the ritual Backlog step should be showing, given whichever one the
 * reader last landed on and the counts as they stand now.
 *
 * `current` while it still has tasks; otherwise the next bucket that does, in
 * the hero's order. Clearing out Left Behind moves the reader on to Overdue
 * rather than leaving them looking at an empty list they have to notice and
 * re-filter their way out of — which is the point of the step, working down
 * what is slipping until there is none of it left.
 *
 * **The emptiness is what licenses the move.** A preset that still has tasks in
 * it is never swapped: derived from the counts alone, the filter would jump the
 * moment a *different* bucket changed and the reader would lose their place
 * mid-list. And a preset outside the hero's three ("Unscheduled", "No Filter")
 * is a detour the reader chose deliberately, so it is left alone whether or not
 * it is empty — this step has no opinion about it.
 *
 * Pure, so the step derives it during render rather than reaching for an effect
 * to chase the counts.
 */
export function nextBacklogFilter(
  current: TFilterId,
  counts: TBacklogCounts,
): TFilterId {
  if (!isCountedFilter(current) || counts[current] > 0) return current;
  return defaultBacklogFilter(counts);
}
