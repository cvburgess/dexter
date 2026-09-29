import { Temporal } from "@js-temporal/polyfill";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { ColumnChip } from "@/components/ColumnChip";
import { DayTaskList } from "@/components/DayTaskList";
import { EventRow } from "@/components/EventRow";
import { HabitTracker } from "@/components/HabitTracker";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { formatMonthDay, formatWeekday } from "@/utils/formatPlainDate";
import { useTheme } from "@/utils/theme";
import { sortAgenda } from "@/utils/tomorrowPreview";

type TWeekDayColumnProps = {
  date: Temporal.PlainDate;
  enableHabits: boolean;
  /** Passed in rather than recomputed — the parent already finds today's
   * column to anchor the scroll. */
  isToday: boolean;
  showCalendar?: boolean;
};

// One day of the Week tab (DEX-96): chip + habit rings + events (DEX-186) +
// task list, read-only — creating a task goes through the tab's single "+".
export function WeekDayColumn({
  date,
  enableHabits,
  isToday,
  showCalendar = false,
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
      {showCalendar && <DayEvents date={date} />}
      {/* No empty state: seven "no tasks" messages side by side read as noise,
          and an empty column is already self-evident. */}
      <DayTaskList date={date} emptyMessage={null} />
    </View>
  );
}

// Its own component so the calendar query only mounts while shown. Natural
// height above DayTaskList's flex:1 scroller, which takes what's left.
function DayEvents({ date }: { date: Temporal.PlainDate }) {
  const theme = useTheme();
  const [events] = useCalendarEvents(date);
  const agenda = useMemo(() => sortAgenda(events), [events]);

  // No empty or error text, for the same reason as the task list's.
  if (agenda.length === 0) return null;

  return (
    <View
      style={{ gap: theme.space.sm, marginTop: theme.space.md }}
      testID={`week-events-${date.toString()}`}
    >
      {agenda.map((event) => (
        <EventRow event={event} key={event.id} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fills the drop target WeekView sizes; bounds DayTaskList's flex:1
  // ScrollView so it scrolls.
  container: {
    flex: 1,
  },
});
