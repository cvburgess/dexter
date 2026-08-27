import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, View } from "react-native";

import { DayTaskList } from "@/components/DayTaskList";
import { HabitTracker } from "@/components/HabitTracker";
import { usePreferences } from "@/hooks/usePreferences";

type TTasksViewProps = {
  date: Temporal.PlainDate;
};

/**
 * Habits + the day's task list for `date` — the always-visible pane of the
 * Today tab. Composable so it can be shown alone (small screens) or beside
 * other panes (large screens); see `today/index.tsx`.
 *
 * The list itself lives in `DayTaskList`, which the Week tab's day columns
 * reuse (DEX-96).
 */
export function TasksView({ date }: TTasksViewProps) {
  const [preferences] = usePreferences();

  return (
    // Bottom-up so the task list, not HabitTracker's horizontal ScrollView,
    // is first in the subview tree UIKit picks to minimize against (DEX-136).
    <View style={styles.reversed}>
      <DayTaskList date={date} />
      {preferences.enableHabits && <HabitTracker date={date} />}
    </View>
  );
}

const styles = StyleSheet.create({
  reversed: {
    flex: 1,
    flexDirection: "column-reverse",
  },
});
