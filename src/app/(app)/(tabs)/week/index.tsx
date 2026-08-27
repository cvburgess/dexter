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

// The Week tab (DEX-96) — large screens only; web/tablets register the route
// at every width so a deep-linked /week below the breakpoint still resolves.
export default function WeekScreen() {
  const [preferences] = usePreferences();
  const largeDevice = useIsLargeDevice();
  const theme = useTheme();

  // Subscribed via useToday (DEX-161), passed to WeekView as a prop — a
  // captured-once value once let the chip and scheduling disagree.
  const today = useToday();

  const [monday, setMonday] = useState<Temporal.PlainDate>(
    () => weekOf(today).monday,
  );

  // Follow midnight rollover only while showing the week that just stopped
  // holding today — paging away is a choice rollover shouldn't undo (DEX-161).
  const [lastToday, setLastToday] = useState(today);
  if (!today.equals(lastToday)) {
    setLastToday(today);
    if (weekOf(lastToday).monday.equals(monday))
      setMonday(weekOf(today).monday);
  }

  // What "new task" defaults to: today if in view, else the week's Monday.
  // Stable identity is load-bearing — usePublishViewedDay keys its effect on it.
  const targetDate = useMemo(
    () => (weekOf(today).monday.equals(monday) ? today : monday),
    [monday, today],
  );

  usePublishViewedDay(targetDate);

  // Monday, not targetDate: reach only widens, so covering the earliest
  // column covers all seven (DEX-162).
  useExpandTaskReach(monday);

  if (!largeDevice) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.narrow, { backgroundColor: theme.colors.background }]}
      >
        {/* Doesn't name a device — a tablet in a narrow Split View slice
            reaches this branch too (DEX-104). */}
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
