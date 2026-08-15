import { Temporal } from "@js-temporal/polyfill";
import { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyScreen } from "@/components/EmptyScreen";
import { WeekView } from "@/components/WeekView";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { useExpandTaskReach } from "@/hooks/useTaskReach";
import { useToday } from "@/hooks/useToday";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import { useTheme } from "@/utils/theme";
import { weekOf } from "@/utils/weekStartEnd";

/**
 * The Week tab (DEX-96) — seven day columns at once, for planning a week
 * rather than working a day.
 *
 * Large screens only. On **web and tablets** the route is registered at every
 * width even though its `NAV_ITEMS` entry isn't (`components/AppShell.tsx`
 * lists `<Tabs.Screen name="week" />` unconditionally), because a `/week` URL
 * typed, bookmarked, or deep-linked below the breakpoint still has to resolve —
 * which is what the below-the-breakpoint branch here answers with. On a
 * **phone** it can't work that way, and doesn't need to: `NativeTabs` only
 * registers routes that have a trigger, and `_layout.tsx` declares no `week`
 * trigger at all, so the route simply doesn't exist there. Branching inside
 * rather than swapping the wrapper is what lets a tablet cross the breakpoint
 * live — an iPad rotating, or resizing in Split View — without remounting.
 */
export default function WeekScreen() {
  const [preferences] = usePreferences();
  const largeDevice = useIsLargeDevice();
  const theme = useTheme();

  // Subscribed, not read from the clock: `useToday` re-renders this screen when
  // the day changes and hands back the same object until it does (DEX-161).
  // Read *here* for the whole screen — `WeekView` takes it as a prop instead of
  // calling the clock again, so the day the columns highlight and the day tasks
  // get scheduled onto cannot disagree. They did when this was captured once:
  // an app left open across midnight moved the today chip but kept scheduling
  // onto yesterday.
  const today = useToday();

  const [monday, setMonday] = useState<Temporal.PlainDate>(
    () => weekOf(today).monday,
  );

  // Follow the day changing under the screen, and only while the week on
  // screen is the one that just stopped holding today — paging to another week
  // is a choice the rollover has no business undoing (DEX-161).
  const [lastToday, setLastToday] = useState(today);
  if (!today.equals(lastToday)) {
    setLastToday(today);
    if (weekOf(lastToday).monday.equals(monday))
      setMonday(weekOf(today).monday);
  }

  // The day both "+" entry points schedule onto, and what the create-task
  // modal defaults to while this tab is focused. Today when it's in view —
  // which is what the user means by "new task" on the current week — and the
  // week's Monday otherwise, so a task created while looking at another week
  // lands in the week being looked at rather than silently on today.
  //
  // The memo's stable identity is load-bearing: `usePublishViewedDay` keys its
  // focus effect on it, and a fresh `PlainDate` each render would tear the
  // effect down and re-register it on every unrelated re-render, momentarily
  // clearing the module-scoped viewed day the nav rail's "+" reads. `today`
  // carries that identity itself, so the memo only has to preserve it.
  const targetDate = useMemo(
    () => (weekOf(today).monday.equals(monday) ? today : monday),
    [monday, today],
  );

  usePublishViewedDay(targetDate);

  // The week's Monday, not `targetDate`: the reach only ever widens, so covering
  // the earliest column covers all seven (DEX-162).
  useExpandTaskReach(monday);

  if (!largeDevice) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.narrow, { backgroundColor: theme.colors.background }]}
      >
        {/* EmptyScreen already fills and centers, and reserves the bottom
            inset itself — it needs no wrapper of its own. */}
        {/* Deliberately doesn't name a device: since DEX-104 a tablet reaches
            this branch too (an iPad in a narrow Split View slice, or a
            deep-linked `/week` on a small Android tablet), where "open Dexter
            on a tablet" would be advice the user has already taken. */}
        <EmptyScreen message="The Week view needs a wider screen. Use the Today tab here, or open Dexter on a larger one." />
      </SafeAreaView>
    );
  }

  return (
    <WeekView
      enableHabits={preferences.enableHabits}
      monday={monday}
      onChangeWeek={setMonday}
      targetDate={targetDate}
      today={today}
    />
  );
}

const styles = StyleSheet.create({
  narrow: {
    flex: 1,
  },
});
