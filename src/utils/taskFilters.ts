import { Temporal } from "@js-temporal/polyfill";

import { ETaskStatus, TTask } from "@/api/tasks";

export type TFilterId =
  "none" | "overdue" | "dueSoon" | "leftBehind" | "unscheduled";

const DUE_SOON_WINDOW_DAYS = 13;

/** Shared with `hooks/useTasks.tsx`'s recurring-task logic, which needs the same DONE/WONT_DO classification. */
export const isCompletionStatus = (status: ETaskStatus | undefined): boolean =>
  status === ETaskStatus.DONE || status === ETaskStatus.WONT_DO;

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
 * Incomplete tasks unscheduled or scheduled for a day other than `date` — the
 * Backlog drawer's base scope (on-device equivalent of the former
 * `notScheduledForDateFilters` server query, DEX-57).
 */
export function selectBacklogTasks(
  tasks: TTask[],
  date: Temporal.PlainDate,
): TTask[] {
  const iso = date.toString();
  return tasks.filter(
    (task) => isIncomplete(task) && task.scheduledFor !== iso,
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
 * True when any *incomplete* task is overdue or left behind as of `today` —
 * drives the Backlog attention dot (DEX-58). Anchored to today, not the viewed
 * day, since it signals "you have stragglers" regardless of which day is on
 * screen. Uses the same strict `< today` boundary as the drawer's Overdue /
 * Left Behind filter presets (a task due today is not yet overdue). The status
 * guard matters: `filterTasks`'s presets don't check completion themselves (the
 * drawer pre-scopes to incomplete via `selectBacklogTasks`), so a completed
 * past-due task must not light the dot here.
 */
export function hasBacklogAttention(
  tasks: TTask[],
  today: Temporal.PlainDate,
): boolean {
  const todayIso = today.toString();
  return tasks.some(
    (task) =>
      isIncomplete(task) &&
      (isOverdue(task, todayIso) || isLeftBehind(task, todayIso)),
  );
}
