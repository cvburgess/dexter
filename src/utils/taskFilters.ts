import { Temporal } from "@js-temporal/polyfill";

import { ETaskStatus, TTask } from "@/api/tasks";

export type TFilterId =
  "none" | "overdue" | "dueSoon" | "leftBehind" | "unscheduled";

const DUE_SOON_WINDOW_DAYS = 13;

/** Shared with `hooks/useTasks.tsx`'s recurring-task logic, which needs the same DONE/WONT_DO classification. */
export const isCompletionStatus = (status: ETaskStatus | undefined): boolean =>
  status === ETaskStatus.DONE || status === ETaskStatus.WONT_DO;

const isIncomplete = (task: TTask): boolean => !isCompletionStatus(task.status);

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
      return tasks.filter(
        (task) => task.dueOn !== null && task.dueOn < todayIso,
      );
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
      return tasks.filter(
        (task) => task.scheduledFor !== null && task.scheduledFor < todayIso,
      );
    case "unscheduled":
      return tasks.filter((task) => task.scheduledFor === null);
  }
}
