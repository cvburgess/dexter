import { Temporal } from "@js-temporal/polyfill";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";

import { LargeScreenToday } from "@/components/LargeScreenToday";
import { SmallScreenToday } from "@/components/SmallScreenToday";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import { backlogAttentionFilter } from "@/utils/taskFilters";
import { parseDayLink } from "@/utils/todayRoute";

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
  const multiPane = useIsLargeDevice();
  // `?date=&mode=&q=&n=` — the deep-link contract the Search tab builds
  // (`utils/todayRoute.ts`, DEX-47). Null for an ordinary tab press, which is
  // why the state below still seeds itself from today. Typed loosely on purpose:
  // `useLocalSearchParams` hands back a `string[]` for a repeated key, so
  // `parseDayLink` narrows rather than trusting the shape.
  const params = useLocalSearchParams<{
    date?: string | string[];
    mode?: string | string[];
    q?: string | string[];
    n?: string | string[];
  }>();
  const link = parseDayLink(params);
  const [day, setDay] = useState<TDayState>(() => ({
    date: link?.date ?? Temporal.Now.plainDateISO(),
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

  // Follow a `?date=` that arrives after mount. Navigating here from the Search
  // tab re-renders this screen with new params rather than remounting it, so the
  // initial state above only covers a cold open — this covers every later tap.
  //
  // Adjusted during render (React's supported pattern for deriving state from a
  // changed prop, as `SmallScreenToday` already does for a disabled view) rather
  // than in an effect: React re-runs this component before painting, so the day
  // never renders wrong for a frame first. `appliedLinkId` is what makes it fire
  // once per navigation — without it this would re-apply on every render and
  // stomp the user's own day navigation. Keyed on `link.id` rather than the date
  // itself, so re-following a link the user has since navigated away from still
  // takes effect (see `TTodayRouteParams["n"]`).
  const [appliedLinkId, setAppliedLinkId] = useState(link?.id ?? null);
  if ((link?.id ?? null) !== appliedLinkId) {
    setAppliedLinkId(link?.id ?? null);
    if (link?.date) {
      const direction = Temporal.PlainDate.compare(link.date, day.date);
      // Skip when the link points at the day already on screen: `direction`
      // drives the day-change animation, and restarting it for no movement
      // reads as a flicker.
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
