import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, View } from "react-native";

import { DayTaskList } from "@/components/DayTaskList";
import { HabitTracker } from "@/components/HabitTracker";
import { usePreferences } from "@/hooks/usePreferences";

type TTasksViewProps = {
  date: Temporal.PlainDate;
};

// Habits + the day's task list — the always-visible Today pane, composable
// so it stands alone or beside other panes. List lives in DayTaskList (DEX-96).
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
