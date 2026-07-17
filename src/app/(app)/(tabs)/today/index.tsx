import { Temporal } from "@js-temporal/polyfill";
import { useMemo, useState } from "react";

import { LargeScreenToday } from "@/components/LargeScreenToday";
import { SmallScreenToday } from "@/components/SmallScreenToday";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import { backlogAttentionFilter } from "@/utils/taskFilters";

type TDayState = {
  date: Temporal.PlainDate;
  direction: -1 | 0 | 1;
};

// Owns only the state genuinely shared between the two layouts — the viewed day,
// preferences, and the backlog-attention signal — then hands off to whichever
// layout fits the screen. Each layout owns its own view/pane state internally
// (see SmallScreenToday / LargeScreenToday) so a change to one can't affect the
// other.
export default function TodayScreen() {
  const [preferences] = usePreferences();
  const multiPane = useIsMultiPane();
  const [day, setDay] = useState<TDayState>(() => ({
    date: Temporal.Now.plainDateISO(),
    direction: 0,
  }));
  // So "New Task" opened from this tab defaults its schedule to the viewed day.
  usePublishViewedDay(day.date);

  // Drives the Backlog attention dot and the filter that tapping Backlog
  // pre-applies (DEX-58): the Filter preset for the first overdue/left-behind
  // task (Overdue wins), or null when there's nothing. Anchored to the real
  // today, not `day.date` — it signals stragglers regardless of which day is on
  // screen. Reads the shared, already-warm `["tasks"]` cache the panes use, so
  // it costs no extra fetch.
  const [allTasks] = useTasks();
  const attentionFilter = useMemo(
    () => backlogAttentionFilter(allTasks, Temporal.Now.plainDateISO()),
    [allTasks],
  );
  const backlogAttention = attentionFilter !== null;

  const changeDate = (next: Temporal.PlainDate) =>
    setDay(({ date }) => ({
      date: next,
      direction: Temporal.PlainDate.compare(next, date),
    }));

  const changeDateBy = (days: 1 | -1) =>
    setDay(({ date }) => {
      const next = date.add({ days });
      return { date: next, direction: Temporal.PlainDate.compare(next, date) };
    });

  return multiPane ? (
    <LargeScreenToday
      date={day.date}
      preferences={preferences}
      changeDate={changeDate}
      attentionFilter={attentionFilter}
      backlogAttention={backlogAttention}
    />
  ) : (
    <SmallScreenToday
      date={day.date}
      direction={day.direction}
      preferences={preferences}
      changeDate={changeDate}
      changeDateBy={changeDateBy}
      attentionFilter={attentionFilter}
      backlogAttention={backlogAttention}
    />
  );
}
