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
    // Laid out bottom-up so the task list is the *first* child in the view
    // tree while still rendering below the habit row (DEX-136). UIKit picks a
    // tab screen's content scroll view by walking first subviews, and
    // `HabitTracker` is a **horizontal** ScrollView: reached first, it becomes
    // the scroll view the tab bar tries to minimize against and never reports
    // a vertical scroll. Reversing the column moves the vertical scroller to
    // the front of the subview order without moving a pixel — React Native
    // mounts native subviews in JSX order whatever the flex direction is. See
    // docs/frontend.md, "Safe areas and keyboard".
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
