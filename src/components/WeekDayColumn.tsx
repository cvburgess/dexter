import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, View } from "react-native";

import { ColumnChip } from "@/components/ColumnChip";
import { DayTaskList } from "@/components/DayTaskList";
import { HabitTracker } from "@/components/HabitTracker";
import { formatMonthDay, formatWeekday } from "@/utils/formatPlainDate";
import { useTheme } from "@/utils/theme";

type TWeekDayColumnProps = {
  date: Temporal.PlainDate;
  enableHabits: boolean;
  /** Passed in rather than recomputed — the parent already finds today's
   * column to anchor the scroll. */
  isToday: boolean;
};

// One day of the Week tab (DEX-96): chip + habit rings + task list, read-only —
// creating a task goes through the tab's single "+" (see WeekView).
export function WeekDayColumn({
  date,
  enableHabits,
  isToday,
}: TWeekDayColumnProps) {
  const theme = useTheme();

  const iso = date.toString();
  // One source for the day's wording, so the chip and its accessibility label
  // can't drift apart.
  const label = `${formatWeekday(date)} ${formatMonthDay(date)}`;

  return (
    <View style={styles.container} testID={`week-column-${iso}`}>
      <ColumnChip
        accessibilityLabel={isToday ? `${label}, today` : label}
        highlighted={isToday}
        subtitle={formatMonthDay(date)}
        testID={`week-chip-${iso}`}
        title={formatWeekday(date)}
      />
      {enableHabits && (
        <View style={{ marginTop: theme.space.md }}>
          <HabitTracker date={date} showCreateNudge={false} />
        </View>
      )}
      {/* No empty state: seven "no tasks" messages side by side read as noise,
          and an empty column is already self-evident. */}
      <DayTaskList date={date} emptyMessage={null} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Flexes to share the row with the other six columns, capped at
  // WEEK_COLUMN_MIN_WIDTH; bounds DayTaskList's flex:1 ScrollView so it scrolls.
  container: {
    flex: 1,
  },
});
