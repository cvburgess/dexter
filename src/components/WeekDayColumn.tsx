import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, Text, View } from "react-native";

import { DayTaskList } from "@/components/DayTaskList";
import { HabitTracker } from "@/components/HabitTracker";
import { formatMonthDay, formatWeekday } from "@/utils/formatPlainDate";
import { useTheme, withOpacity } from "@/utils/theme";

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
  const chipColor = isToday ? theme.colors.background : theme.colors.text;

  return (
    <View style={styles.container} testID={`week-column-${iso}`}>
      <View
        // Not a button — every day is already on screen, so there is
        // nothing to navigate to.
        accessibilityLabel={isToday ? `${label}, today` : label}
        accessible
        style={[
          styles.chip,
          {
            backgroundColor: isToday
              ? withOpacity(theme.colors.text, 0.8)
              : "transparent",
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
            // `xs` separates a label from the thing it labels (docs/design.md).
            gap: theme.space.xs,
            // The height *is* the vertical padding — lines center in it.
            // `lg` cleared the title-sized name; `xs` read as cramped.
            height: theme.controls.md + theme.space.lg,
            paddingHorizontal: theme.space.sm,
          },
        ]}
        testID={`week-chip-${iso}`}
      >
        <Text
          numberOfLines={1}
          // `title`: the day name is the heading, the date below is `subtitle`.
          style={[theme.fonts.title, { color: chipColor }]}
        >
          {formatWeekday(date)}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            theme.fonts.subtitle,
            styles.chipSubtitle,
            { color: chipColor },
          ]}
        >
          {formatMonthDay(date)}
        </Text>
      </View>
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
  // Full column width via stretch; height pinned inline and not `flex`, or
  // growing would stretch it down the column instead of across it.
  chip: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "hidden",
  },
  // The date is the day name's `subtitle`, dimmed, so the pair reads as one
  // label rather than two competing lines.
  chipSubtitle: {
    opacity: 0.8,
  },
});
