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

  // Every non-archived habit — used only to tell "no habits at all" (show the
  // create nudge) apart from "none scheduled for this weekday" (show nothing).
  const [allHabits, { isLoading: allHabitsLoading }] = useHabits();

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

  // Drop rings for habits that have since been paused or archived: the DB
  // trigger removes today's daily row on pause/archive, but the client's
  // dailyHabits cache isn't invalidated by a habit edit, so filter defensively
  // (this also keeps today/past consistent with the filtered future path).
  const activeDailyHabits = dailyHabits.filter(
    (dailyHabit) =>
      !dailyHabit.habits.isPaused && !dailyHabit.habits.isArchived,
  );

  // Whether any active habit for this day still lacks a daily_habits row.
  const hasMissingHabit = habits.some(
    (habit) =>
      !dailyHabits.some((dailyHabit) => dailyHabit.habitId === habit.id),
  );

  // Instantiate this day's rows for any active habit not yet tracked. Guarded
  // on `hasMissingHabit` so the mutation (which throws when nothing is missing)
  // is only called when there's work to do, and on both queries being loaded so
  // it never runs against a still-loading (empty) habits list. Re-runs when a
  // habit is added (hasMissingHabit flips true) and settles once rows exist.
  useEffect(() => {
    if (
      !isFutureDate &&
      !dailyHabitsLoading &&
      !habitsLoading &&
      hasMissingHabit
    ) {
      createDailyHabits();
    }
    // createDailyHabits reads the latest habits/dailyHabits via react-query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, dailyHabitsLoading, habitsLoading, isFutureDate, hasMissingHabit]);

  if (habitsLoading || dailyHabitsLoading || allHabitsLoading) {
    return <ScrollView horizontal style={styles.container} />;
  }

  // First-run nudge (today/past only): the user has no habits at all yet.
  if (!isFutureDate && allHabits.length === 0) {
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

  // Nothing scheduled for this day (e.g. weekday-only habits viewed on a
  // weekend): render an empty row rather than the create nudge.
  const rings = isFutureDate ? habits : activeDailyHabits;
  if (rings.length === 0) {
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
        : activeDailyHabits.map((dailyHabit) => (
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
