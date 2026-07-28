import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { DayTaskList } from "@/components/DayTaskList";
import { GlassIconButton } from "@/components/GlassIconButton";
import { HabitTracker } from "@/components/HabitTracker";
import { formatMonthDay, formatWeekday } from "@/utils/formatPlainDate";
import { useTheme, withOpacity } from "@/utils/theme";

type TWeekDayColumnProps = {
  date: Temporal.PlainDate;
  /** Mirrors `preferences.enableHabits`; read once by the parent for all seven columns. */
  enableHabits: boolean;
};

/**
 * One day of the Week tab (DEX-96): a header chip naming the day, a "+" that
 * creates a task already scheduled for it, the day's habit rings, and the
 * day's task list.
 *
 * The chip's "today" treatment is the app's established active-large-screen-nav
 * fill — the inverted ink color behind the background color, the same pair
 * `WebNavRail` uses for its selected tile, and a direct port of the legacy
 * app's `bg-base-content/80 text-base-100` badge.
 */
export function WeekDayColumn({ date, enableHabits }: TWeekDayColumnProps) {
  const theme = useTheme();
  const router = useRouter();

  const isToday = Temporal.Now.plainDateISO().equals(date);
  const iso = date.toString();

  return (
    <View style={styles.container} testID={`week-column-${iso}`}>
      <View style={[styles.header, { gap: theme.gap }]}>
        <View
          // Not a button: the chip is a label, and the whole point of the
          // Week tab is that every day is already on screen — there is
          // nothing for tapping a day to navigate to.
          accessibilityLabel={`${formatWeekday(date)} ${formatMonthDay(date)}${
            isToday ? ", today" : ""
          }`}
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
            style={[
              styles.chipTitle,
              { color: isToday ? theme.colors.background : theme.colors.text },
            ]}
          >
            {formatWeekday(date)}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.chipSubtitle,
              { color: isToday ? theme.colors.background : theme.colors.text },
            ]}
          >
            {formatMonthDay(date)}
          </Text>
        </View>
        <GlassIconButton
          accessibilityLabel={`New task on ${formatWeekday(date)} ${formatMonthDay(date)}`}
          ionicon="add-outline"
          onPress={() =>
            router.push({
              pathname: "/new-task",
              params: { scheduledFor: iso },
            })
          }
          sfSymbol="plus"
          size={32}
        />
      </View>
      {enableHabits && <HabitTracker date={date} showCreateNudge={false} />}
      {/* Shorter than the Today pane's copy — a column is narrow enough that
          the full sentence wraps to three lines. */}
      <DayTaskList date={date} emptyMessage="No tasks" />
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 16,
  },
  // Fills the header row beside the "+", with the two lines stacked and
  // centered like the legacy badge. Height is pinned so a column whose day
  // name wraps differently can't sit a pixel off from its neighbours.
  chip: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 44,
    justifyContent: "center",
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
