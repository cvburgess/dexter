import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

import { habitFilters, useDailyHabits, useHabits } from "@/hooks/useHabits";
import { useTheme } from "@/utils/theme";

import { HabitRing } from "./HabitRing";

// Reserve a stable height whether the row is loading, empty, or full so the
// task list below it never jumps as habits resolve.
const TRACKER_HEIGHT = 48;

type THabitTrackerProps = {
  date: Temporal.PlainDate;
};

/**
 * The Today-view habit row: tappable emoji rings that log progress. Ported from
 * dexter-app's `DailyHabits`. Future dates show dimmed, inert rings because
 * their daily rows aren't created until the day arrives.
 */
export function HabitTracker({ date }: THabitTrackerProps) {
  const theme = useTheme();
  const router = useRouter();

  const today = Temporal.Now.plainDateISO();
  const isFutureDate = Temporal.PlainDate.compare(date, today) > 0;

  // Active, unpaused habits for this weekday — the source of truth for future
  // dates, and what `createDailyHabits` bootstraps against for today/past.
  const [habits, { isLoading: habitsLoading }] = useHabits({
    filters: [
      ...habitFilters.notPaused,
      ...habitFilters.activeForDay(date.dayOfWeek),
    ],
  });

  const [
    dailyHabits,
    { createDailyHabits, incrementDailyHabit, isLoading: dailyHabitsLoading },
  ] = useDailyHabits(date.toString());

  // Instantiate today's rows for any active habit not yet tracked. The mutation
  // itself no-ops on future dates and when nothing is missing.
  useEffect(() => {
    if (!isFutureDate && !dailyHabitsLoading) createDailyHabits();
    // createDailyHabits closes over the latest habits/dailyHabits; re-run only
    // when the date or load state changes (matches the legacy behavior).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, dailyHabitsLoading, isFutureDate]);

  if (habitsLoading || dailyHabitsLoading) {
    return <ScrollView horizontal style={styles.container} />;
  }

  // First-run nudge (today/past only): no habits at all yet.
  if (!isFutureDate && dailyHabits.length === 0 && habits.length === 0) {
    return (
      <TouchableOpacity
        accessibilityRole="link"
        onPress={() => router.push("/settings/habits")}
        style={styles.empty}
      >
        <Text style={[styles.emptyText, { color: theme.colors.primary }]}>
          Create a habit
        </Text>
      </TouchableOpacity>
    );
  }

  if (isFutureDate && habits.length === 0) {
    return <ScrollView horizontal style={styles.container} />;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {isFutureDate
        ? habits.map((habit) => (
            <HabitRing
              key={habit.id}
              emoji={habit.emoji}
              percentComplete={0}
              faded
              accessibilityLabel={habit.title}
            />
          ))
        : dailyHabits.map((dailyHabit) => (
            <HabitRing
              key={dailyHabit.habitId}
              emoji={dailyHabit.habits.emoji}
              percentComplete={dailyHabit.percentComplete}
              accessibilityLabel={`${dailyHabit.habits.title} (${dailyHabit.stepsComplete}/${dailyHabit.steps})`}
              onPress={() => incrementDailyHabit(dailyHabit)}
            />
          ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
    height: TRACKER_HEIGHT,
  },
  content: {
    alignItems: "center",
    flexGrow: 1,
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  empty: {
    alignItems: "center",
    height: TRACKER_HEIGHT,
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
  },
});
