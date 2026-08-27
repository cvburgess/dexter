import { Temporal } from "@js-temporal/polyfill";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";

import { LargeScreenToday } from "@/components/LargeScreenToday";
import { SmallScreenToday } from "@/components/SmallScreenToday";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { useExpandTaskReach } from "@/hooks/useTaskReach";
import { useTasks } from "@/hooks/useTasks";
import { useToday } from "@/hooks/useToday";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import { backlogAttentionFilter } from "@/utils/taskFilters";
import { parseDayLink } from "@/utils/todayRoute";

type TDayState = {
  date: Temporal.PlainDate;
  direction: -1 | 0 | 1;
};

// Owns only state shared between the two layouts (day, preferences, the
// backlog-attention signal); each layout owns its own view/pane state.
export default function TodayScreen() {
  const [preferences] = usePreferences();
  const multiPane = useIsLargeDevice();
  // `?date=&mode=&q=&n=` deep-link contract (utils/todayRoute.ts, DEX-47);
  // typed loosely since a repeated key hands back a string[].
  const params = useLocalSearchParams<{
    date?: string | string[];
    mode?: string | string[];
    q?: string | string[];
    n?: string | string[];
  }>();
  const link = parseDayLink(params);
  const today = useToday();
  const [day, setDay] = useState<TDayState>(() => ({
    date: link?.date ?? today,
    direction: 0,
  }));
  // So "New Task" opened from this tab defaults its schedule to the viewed day.
  usePublishViewedDay(day.date);
  // So paging to a day older than the canonical fetch's reach loads it, rather
  // than drawing it as empty of closed-out work (DEX-162).
  useExpandTaskReach(day.date);

  // Drives the Backlog attention dot (DEX-58); anchored to the real today,
  // not day.date, so it signals stragglers regardless of the day shown.
  const [allTasks] = useTasks();
  const attentionFilter = useMemo(
    () => backlogAttentionFilter(allTasks, today),
    [allTasks, today],
  );

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

  // Follow midnight foreground/resume (DEX-161) only if showing the day that
  // ended. Adjusted during render, before the link below, so it still wins.
  const [lastToday, setLastToday] = useState(today);
  if (!today.equals(lastToday)) {
    setLastToday(today);
    if (day.date.equals(lastToday)) {
      // Derived, not hardcoded to 1: flying east across the date line moves
      // the day back, and direction drives the change animation.
      setDay({
        date: today,
        direction: Temporal.PlainDate.compare(today, day.date),
      });
    }
  }

  // Follow a `?date=` arriving after mount, adjusted during render so the
  // day never paints wrong for a frame; keyed on link.id so a re-follow lands.
  const [appliedLinkId, setAppliedLinkId] = useState(link?.id ?? null);
  if ((link?.id ?? null) !== appliedLinkId) {
    setAppliedLinkId(link?.id ?? null);
    if (link?.date) {
      const direction = Temporal.PlainDate.compare(link.date, day.date);
      // Skip a link pointing at the day already on screen — restarting the
      // change animation for no movement reads as a flicker.
      if (direction !== 0) setDay({ date: link.date, direction });
    }
  }

  return multiPane ? (
    <LargeScreenToday
      date={day.date}
      preferences={preferences}
      changeDate={changeDate}
      attentionFilter={attentionFilter}
      link={link}
    />
  ) : (
    <SmallScreenToday
      date={day.date}
      direction={day.direction}
      preferences={preferences}
      changeDate={changeDate}
      changeDateBy={changeDateBy}
      attentionFilter={attentionFilter}
      link={link}
    />
  );
}
