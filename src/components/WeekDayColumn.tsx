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
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
            // `xs` is the step that separates a label from the thing it labels
            // (see docs/design.md), which is exactly what the date is to the
            // day name above it. The two lines had been flush.
            gap: theme.space.xs,
            // Two stacked lines plus their padding; pinned so a column whose day
            // name renders taller can't sit a pixel off from its neighbours.
            // The height *is* the vertical padding here — the lines are centered
            // in it, so `paddingVertical` would only eat the content box rather
            // than add breathing room. `space.lg` on top of the control step is
            // the top of the spacing scale, which is what the `title`-sized day
            // name wants above and below it; at `xs` this cleared its text by
            // about four points and read as cramped.
            height: theme.controls.md + theme.space.lg,
            paddingHorizontal: theme.space.sm,
          },
        ]}
        testID={`week-chip-${iso}`}
      >
        <Text
          numberOfLines={1}
          // `title`, not `subtitle`: the day name is the column's heading, and
          // the date below it is the subtitle — the same two-line pairing the
          // task, habit and settings rows use.
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
      <DayTaskList date={date} emptyMessage={null} inset={false} />
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
  // Runs the full width of the column (the container's default `stretch` does
  // that), flush like the task list below it — a side gutter here would stack
  // with the neighbouring column's and double every gap in the grid. The two
  // lines are stacked and centered like the legacy badge. Its height is pinned
  // inline, and deliberately *not* `flex` — the container is a flex column, so
  // growing would stretch the chip down the column instead of across it.
  chip: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "hidden",
  },
  // The date is the day name's `subtitle` — a role below it and dimmed — so
  // the pair reads as one label with a clear primary line rather than two
  // competing ones.
  chipSubtitle: {
    opacity: 0.8,
  },
});
