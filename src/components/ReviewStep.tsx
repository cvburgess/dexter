import { Temporal } from "@js-temporal/polyfill";
import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { duplicateTaskInput } from "@/api/tasks";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { HabitTracker } from "@/components/HabitTracker";
import {
  HeroLines,
  type THeroLine,
  useHeroReveal,
  useStageOpacity,
} from "@/components/HeroLines";
import { TaskCard } from "@/components/TaskCard";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useFocusBlocks } from "@/hooks/useFocusBlocks";
import { useDailyHabits } from "@/hooks/useHabits";
import { useTaskDelete } from "@/hooks/useTaskDelete";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";
import { selectCompletedTasksForDate } from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

/** `1 habit` / `2 habits` — the same inline plural the summary step's hero uses. */
const plural = (count: number, noun: string) =>
  `${noun}${count === 1 ? "" : "s"}`;

type TReviewStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

// Evening Review step (DEX-148): complements Open tasks —
// selectOpenTasksForDate/selectCompletedTasksForDate partition the day.
export function ReviewStep({ date }: TReviewStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [preferences] = usePreferences();

  // How many got *done*, not how many exist — `useDailyHabits`, not `useHabits`.
  const [dailyHabits, { isLoading: habitsLoading }] = useDailyHabits(
    date.toString(),
    { skipQuery: !preferences.enableHabits },
  );
  const [events, { isLoading: eventsLoading }] = useCalendarEvents(date);
  const [allTasks, { isLoading: tasksLoading, updateTask, createTask }] =
    useTasks();
  // The shared repeat-aware delete, not useTasks' raw deleteTask — unreachable
  // here, but a second delete path is the drift this hook prevents.
  const { confirmDelete, confirmationProps } = useTaskDelete();

  const [focusBlocks, { isLoading: focusBlocksLoading }] = useFocusBlocks(
    date.toString(),
  );

  const tasks = useMemo(
    () => selectCompletedTasksForDate(allTasks, date),
    [allTasks, date],
  );

  const completedFocusBlocks = focusBlocks.filter(
    (block) => block.status === "complete",
  ).length;

  // Same paused/archived filter as HabitTracker — a habit edit doesn't
  // invalidate the dailyHabits cache, so the hero could count a stale row.
  const completedHabits = dailyHabits.filter(
    (dailyHabit) =>
      !dailyHabit.habits.isPaused &&
      !dailyHabit.habits.isArchived &&
      dailyHabit.stepsComplete >= dailyHabit.steps,
  ).length;

  // One line per feature the reader has, not per non-zero count — a calendar
  // line with no calendar is noise, but a zero elsewhere is worth stating.
  const counts = [
    {
      key: "habits",
      figure: String(completedHabits),
      words: `${plural(completedHabits, "habit")} done`,
      shown: preferences.enableHabits,
    },
    {
      key: "tasks",
      figure: String(tasks.length),
      words: `${plural(tasks.length, "task")} done`,
      shown: true,
    },
    {
      key: "events",
      figure: String(events.length),
      // Every event the day held, not just ones whose end time has passed —
      // a wall-clock comparison reads wrong once DayNav pages away from today.
      words: plural(events.length, "event"),
      shown: preferences.enableCalendar,
    },
    {
      key: "focus",
      // `complete` only — cancelled and still-running blocks don't count.
      figure: String(completedFocusBlocks),
      words: plural(completedFocusBlocks, "focus block"),
      shown: true, // no preference gate — nothing turns focus blocks off
    },
  ].filter((line) => line.shown);

  const heroLines: THeroLine[] = counts.map(({ key, figure, words }) => ({
    key,
    figure,
    words,
    // Always `primary`, not sentiment colors — a low count here is a reading
    // of a day already lived, not a warning.
    color: theme.colors.primary,
  }));

  // Held back until every count exists, so the sequence waits rather than
  // running against the empty placeholders the hooks serve while they resolve.
  const isLoading =
    habitsLoading || eventsLoading || tasksLoading || focusBlocksLoading;
  const reveal = useHeroReveal(isLoading ? null : date.toString());
  // Staged at heroLines.length, not BODY_STAGE — this hero runs 2-4 lines.
  const bodyStyle = useStageOpacity(reveal, heroLines.length);

  // Checked first: every hook above serves an empty placeholder while
  // resolving, which would otherwise read as a genuinely empty day.
  if (isLoading) return null;

  // Rings stay worth drawing even with nothing checked off — a habit ticked
  // after dinner is exactly what an evening review is for.
  const habitRow = preferences.enableHabits ? (
    <HabitTracker date={date} showCreateNudge={false} />
  ) : null;

  // No celebration here — a day with nothing closed out is a reading, not a
  // win, so this centers the figures rather than throwing confetti.
  if (tasks.length === 0 && !habitRow) {
    return (
      <View
        style={[
          styles.quiet,
          // The host SafeAreaView omits the bottom edge, so this is paid here.
          { paddingBottom: insets.bottom },
        ]}
        testID="review-step-quiet"
      >
        <HeroLines lines={heroLines} reveal={reveal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* bodyInsetTop hands the top `md` to the body wrapper below, which pays
          it back as its own top padding rather than stacking a second gap. */}
      <HeroLines
        bodyInsetTop={theme.space.md}
        lines={heroLines}
        reveal={reveal}
      />
      {/* Rings + cards under one opacity, no translate — SwipeablePage's intro
          already slides, and a second axis would compound into a drift. */}
      <Animated.View
        style={[styles.body, bodyStyle, { paddingTop: theme.space.md }]}
      >
        {habitRow}
        {/* Plain ScrollView, not FlashList — one day's list is too short to
            virtualize (same call DayTaskList and Open tasks make). */}
        <ScrollView
          contentContainerStyle={{
            gap: theme.space.sm,
            // Zero without rings, or the first card sits twice as far down.
            paddingTop: habitRow ? theme.space.md : 0,
            paddingBottom: theme.space.md + insets.bottom,
          }}
          style={styles.scroll}
        >
          {tasks.map((task) => (
            // A completed TaskCard is a record, not a handle (no menu, rename,
            // badge); mutations stay wired since every path to them is closed.
            <TaskCard
              key={task.id}
              onDelete={() => void confirmDelete(task)}
              onDuplicate={() => createTask(duplicateTaskInput(task))}
              onPromoteSubtask={createTask}
              onUpdate={(diff) => updateTask({ id: task.id, ...diff })}
              task={task}
            />
          ))}
        </ScrollView>
      </Animated.View>
      {/* The repeat-aware delete's prompt; unrelated to each card's own menu. */}
      <ConfirmationModal {...confirmationProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  scroll: { flex: 1 },
  quiet: {
    flex: 1,
    justifyContent: "center",
  },
});
