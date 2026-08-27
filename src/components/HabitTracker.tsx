import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

import {
  canBootstrapDailyHabits,
  habitFilters,
  useDailyHabits,
  useHabits,
} from "@/hooks/useHabits";
import { useToday } from "@/hooks/useToday";
import { useTheme } from "@/utils/theme";

import { HabitRing } from "./HabitRing";

// Reserve a stable height whether the row is loading, empty, or full so the
// task list below it never jumps as habits resolve.
const TRACKER_HEIGHT = 56;

type THabitTrackerProps = {
  date: Temporal.PlainDate;
  /** Week passes false — seven copies of the "Create a habit" nudge reads as noise. */
  showCreateNudge?: boolean;
};

// Tappable emoji rings that log progress. Future dates show dimmed, inert
// rings — their daily rows aren't created until the day arrives.
export function HabitTracker({
  date,
  showCreateNudge = true,
}: THabitTrackerProps) {
  const theme = useTheme();
  const router = useRouter();

  // Subscribed, not clock-read, so rings stop being inert without a remount
  // when the day catches up (DEX-161).
  const today = useToday();
  const isFutureDate = Temporal.PlainDate.compare(date, today) > 0;

  // Skipped when the nudge is suppressed — Week mounts seven of these and
  // none would otherwise render this data.
  const [allHabits, { isLoading: allHabitsLoading }] = useHabits({
    skipQuery: !showCreateNudge,
  });

  // Source of truth for future dates, and what createDailyHabits bootstraps
  // against for today/past.
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

  // A habit edit doesn't invalidate the dailyHabits cache, so filter
  // defensively for paused/archived rows the DB trigger already dropped.
  const activeDailyHabits = dailyHabits.filter(
    (dailyHabit) =>
      !dailyHabit.habits.isPaused && !dailyHabit.habits.isArchived,
  );

  // False for future dates and for days far enough past that creating rows
  // would invent history (DEX-162) — shares the mutation's own guard predicate.
  const canBootstrap = canBootstrapDailyHabits(date, today);

  const hasMissingHabit = habits.some(
    (habit) =>
      !dailyHabits.some((dailyHabit) => dailyHabit.habitId === habit.id),
  );

  // Guarded on hasMissingHabit so the mutation (which throws when nothing is
  // missing) only runs when there's work, and on both queries being loaded.
  useEffect(() => {
    if (
      canBootstrap &&
      !dailyHabitsLoading &&
      !habitsLoading &&
      hasMissingHabit
    ) {
      createDailyHabits();
    }
    // createDailyHabits reads the latest habits/dailyHabits via react-query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, dailyHabitsLoading, habitsLoading, canBootstrap, hasMissingHabit]);

  if (habitsLoading || dailyHabitsLoading || allHabitsLoading) {
    return <ScrollView horizontal style={styles.container} />;
  }

  // First-run nudge (today/past only): the user has no habits at all yet.
  if (showCreateNudge && !isFutureDate && allHabits.length === 0) {
    return (
      <TouchableOpacity
        accessibilityRole="link"
        onPress={() => router.push("/settings/habits")}
        style={styles.empty}
      >
        <Text style={[theme.fonts.body, { color: theme.colors.primary }]}>
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
      // `gap` only — the side gutter is whoever placed it (SwipeablePage on
      // phone, none on the Today pane/Week columns; docs/design.md).
      contentContainerStyle={[styles.content, { gap: theme.space.sm }]}
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
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    height: TRACKER_HEIGHT,
    justifyContent: "center",
  },
});
