import { Temporal } from "@js-temporal/polyfill";
import { useMemo } from "react";

import { TaskCardList } from "@/components/TaskCardList";
import { useTasks } from "@/hooks/useTasks";
import { selectTasksForDate } from "@/utils/taskFilters";

type TDayTaskListProps = {
  date: Temporal.PlainDate;
  /** Shown for an empty day; `null` renders nothing — what Week's columns
   * want, since seven empty-state messages side by side read as noise. */
  emptyMessage?: string | null;
};

// One day's task list, no habit row or header — extracted so Week's day
// columns (DEX-96) share it.
export function DayTaskList({
  date,
  emptyMessage = "No tasks scheduled for this day.",
}: TDayTaskListProps) {
  const [allTasks] = useTasks();
  const tasks = useMemo(
    () => selectTasksForDate(allTasks, date),
    [allTasks, date],
  );

  return <TaskCardList emptyMessage={emptyMessage} tasks={tasks} />;
}
