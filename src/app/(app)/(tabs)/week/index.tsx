import { Temporal } from "@js-temporal/polyfill";
import { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyScreen } from "@/components/EmptyScreen";
import { WeekView } from "@/components/WeekView";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import { useTheme } from "@/utils/theme";
import { weekOf } from "@/utils/weekStartEnd";

/**
 * The Week tab (DEX-96) — seven day columns at once, for planning a week
 * rather than working a day.
 *
 * Large screens only. On **web** the route is registered at every width even
 * though its `WEB_NAV_ITEMS` entry isn't (`_layout.web.tsx` lists
 * `<Tabs.Screen name="week" />` unconditionally), because a `/week` URL typed
 * or bookmarked in a narrow window still has to resolve — which is what the
 * below-the-breakpoint branch here answers with. On **native** it can't work
 * that way: `NativeTabs` only registers routes that have a trigger, so dropping
 * the trigger on a phone drops the route too and this branch is unreachable
 * there. Branching inside rather than swapping the wrapper still matters on
 * iPad, where a Split View resize crosses the breakpoint live.
 */
export default function WeekScreen() {
  const [preferences] = usePreferences();
  const largeDevice = useIsLargeDevice();
  const theme = useTheme();

  const [monday, setMonday] = useState<Temporal.PlainDate>(
    () => weekOf(Temporal.Now.plainDateISO()).monday,
  );

  // The day both "+" entry points schedule onto, and what the create-task
  // modal defaults to while this tab is focused. Today when it's in view —
  // which is what the user means by "new task" on the current week — and the
  // week's Monday otherwise, so a task created while looking at another week
  // lands in the week being looked at rather than silently on today.
  //
  // Memoized because the identity is load-bearing: `usePublishViewedDay` keys
  // its focus effect on it, so a fresh `PlainDate` each render would tear the
  // effect down and re-register it on every unrelated re-render, momentarily
  // clearing the module-scoped viewed day the tab-bar "+" reads.
  const today = useMemo(() => Temporal.Now.plainDateISO(), []);
  const targetDate = useMemo(
    () => (weekOf(today).monday.equals(monday) ? today : monday),
    [monday, today],
  );

  usePublishViewedDay(targetDate);

  if (!largeDevice) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.narrow, { backgroundColor: theme.colors.background }]}
      >
        {/* EmptyScreen already fills and centers, and reserves the bottom
            inset itself — it needs no wrapper of its own. */}
        <EmptyScreen message="The Week view needs a wider screen. Use the Today tab here, or open Dexter on a tablet or desktop." />
      </SafeAreaView>
    );
  }

  return (
    <WeekView
      enableHabits={preferences.enableHabits}
      monday={monday}
      onChangeWeek={setMonday}
      targetDate={targetDate}
    />
  );
}

const styles = StyleSheet.create({
  narrow: {
    flex: 1,
  },
});
