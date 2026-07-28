import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, Text, View } from "react-native";

import { DayTaskList } from "@/components/DayTaskList";
import { HabitTracker } from "@/components/HabitTracker";
import { formatMonthDay, formatWeekday } from "@/utils/formatPlainDate";
import { useTheme, withOpacity } from "@/utils/theme";

type TWeekDayColumnProps = {
  date: Temporal.PlainDate;
  enableHabits: boolean;
  /**
   * Passed in rather than recomputed here: `Temporal.Now.plainDateISO()`
   * re-resolves the system time zone on every call, and the parent already
   * has to find today's column to anchor the scroll.
   */
  isToday: boolean;
};

/**
 * One day of the Week tab (DEX-96): a chip naming the day, the day's habit
 * rings, and the day's task list. Read-only chrome by design — creating a task
 * goes through the tab's single "+" (see `WeekView`), which schedules onto the
 * viewed week rather than per column.
 *
 * The chip's "today" treatment is the app's established active-large-screen-nav
 * fill — the inverted ink color behind the background color, the same pair
 * `WebNavRail` uses for its selected tile, and a direct port of the legacy
 * app's `bg-base-content/80 text-base-100` badge.
 */
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
        // Not a button: the chip is a label, and the whole point of the
        // Week tab is that every day is already on screen — there is
        // nothing for tapping a day to navigate to.
        accessibilityLabel={isToday ? `${label}, today` : label}
        accessible
        style={[
          styles.chip,
          {
            backgroundColor: isToday
              ? withOpacity(theme.colors.text, 0.8)
              : "transparent",
            borderColor: withOpacity(theme.colors.text, 0.1),
            borderRadius: theme.borderRadius,
          },
        ]}
        testID={`week-chip-${iso}`}
      >
        <Text
          numberOfLines={1}
          style={[styles.chipTitle, { color: chipColor }]}
        >
          {formatWeekday(date)}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.chipSubtitle, { color: chipColor }]}
        >
          {formatMonthDay(date)}
        </Text>
      </View>
      {enableHabits && <HabitTracker date={date} showCreateNudge={false} />}
      {/* No empty state: seven "no tasks" messages side by side read as noise,
          and an empty column is already self-evident. */}
      <DayTaskList date={date} emptyMessage={null} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Flexes to share the row's width with the other six columns; the row caps
  // how narrow that can get (WEEK_COLUMN_MIN_WIDTH). `DayTaskList`'s own
  // ScrollView is `flex: 1`, so it needs this bounded height to scroll rather
  // than run past the column.
  container: {
    flex: 1,
  },
  // Spans the column (the container's default `stretch` does that) inset by
  // the same 16pt the task list uses, with the two lines stacked and centered
  // like the legacy badge. Height is pinned, and deliberately *not* `flex` —
  // the container is a flex column, so growing would stretch the chip down the
  // column instead of across it. Pinning also keeps a column whose day name
  // renders taller from sitting a pixel off from its neighbours.
  chip: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: "center",
    marginHorizontal: 16,
    overflow: "hidden",
    paddingHorizontal: 8,
  },
  chipTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  chipSubtitle: {
    fontSize: 11,
    opacity: 0.8,
  },
});
