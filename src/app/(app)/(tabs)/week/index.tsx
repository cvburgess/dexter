import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
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
 * Large screens only. The *route* is registered unconditionally on every
 * device even though the tab/nav entry isn't (see `(tabs)/_layout.tsx` and
 * `WEB_NAV_ITEMS`): mounting and unmounting the route itself would remount the
 * tab navigator, and the route still has to resolve for a `/week` URL typed or
 * bookmarked on web. Below the breakpoint it renders an explanation instead of
 * the grid — the same "branch inside, keep the wrapper stable" rule
 * `settings/_layout.tsx` follows.
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
  const today = Temporal.Now.plainDateISO();
  const targetDate = weekOf(today).monday.equals(monday) ? today : monday;

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
