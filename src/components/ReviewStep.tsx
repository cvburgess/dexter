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

/**
 * The evening ritual's Review step (DEX-148): what the day added up to, counted,
 * over the rings and the cards that back the figures.
 *
 * **The counterpart of the Open tasks step two swipes back, not a second copy of
 * it.** That step lists what is still open so it can be dispatched; this one
 * lists what was closed so it can be read. The two selectors partition the day
 * (`selectOpenTasksForDate` / `selectCompletedTasksForDate`), so no task appears
 * in both and neither list is the other's leftovers.
 *
 * It is also not the morning task-list step DEX-144 removed — see `SummaryStep`
 * for that history. The axis is the same one the Open tasks step differs on: a
 * finished day has no other surface listing it, and the Today tab's list mixes
 * the closed rows in with the open ones rather than answering "what did I get
 * done".
 *
 * Carries no side gutter and no top inset of its own; `SwipeablePage` and the
 * ritual layouts own those (see docs/design.md, "Who owns spacing").
 */
export function ReviewStep({ date }: TReviewStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [preferences] = usePreferences();

  // Progress, not membership — the one count on this step that `useHabits`
  // cannot answer. `SummaryStep` deliberately reads the other hook because it
  // is asking how many habits the day *has*; a review is asking how many of
  // them got done, which only the daily rows know. Skipped outright when habits
  // are off, so a user who turned the feature off adds no observer for it.
  const [dailyHabits, { isLoading: habitsLoading }] = useDailyHabits(
    date.toString(),
    { skipQuery: !preferences.enableHabits },
  );
  // Safe to call unconditionally: the hook reads `enableCalendar` itself and
  // disables its query, so a user with no calendar touches no device API here.
  const [events, { isLoading: eventsLoading }] = useCalendarEvents(date);
  const [allTasks, { isLoading: tasksLoading, updateTask, createTask }] =
    useTasks();
  // The repeat-aware delete the open tasks step and `DayTaskList` share, rather
  // than `useTasks`' raw `deleteTask`. Unreachable from a completed card (see
  // the wiring below), but a second, simpler delete path is precisely the drift
  // this hook exists to prevent, and an unreachable one would be the easiest
  // kind to leave wrong.
  const { confirmDelete, confirmationProps } = useTaskDelete();

  const tasks = useMemo(
    () => selectCompletedTasksForDate(allTasks, date),
    [allTasks, date],
  );

  // Drop rings for habits since paused or archived, the same defensive filter
  // `HabitTracker` applies to the rows it draws: the DB trigger removes the
  // day's row on pause/archive, but a habit edit doesn't invalidate the
  // dailyHabits cache. Without it the hero could count a habit the row below it
  // no longer shows.
  const completedHabits = dailyHabits.filter(
    (dailyHabit) =>
      !dailyHabit.habits.isPaused &&
      !dailyHabit.habits.isArchived &&
      dailyHabit.stepsComplete >= dailyHabit.steps,
  ).length;

  // A line per *feature the reader has*, not per non-zero count — the rule the
  // summary step set. A zero is a reading worth stating (it is most of what a
  // quiet day says), but a calendar line for someone with no calendar is noise.
  // `HeroLines` maps lines onto stages by index, so a shorter list uses fewer.
  const counts = [
    {
      key: "habits",
      figure: String(completedHabits),
      words: `${plural(completedHabits, "habit")} complete`,
      shown: preferences.enableHabits,
    },
    {
      key: "tasks",
      figure: String(tasks.length),
      words: `${plural(tasks.length, "task")} complete`,
      shown: true,
    },
    {
      key: "events",
      figure: String(events.length),
      // **Every event the day held, not the ones whose end time has passed.**
      // The same figure `calendarStats.eventCount` and the summary step report,
      // and the only one that survives `DayNav`: a wall-clock comparison would
      // read zero on a ritual paged to tomorrow and everything on one paged to
      // last week, so the number would mean something different depending on
      // when you looked at it. An event you were at is an event you attended.
      words: plural(events.length, "event"),
      shown: preferences.enableCalendar,
    },
    {
      key: "focus",
      // Hardcoded until DEX-49 builds the focus timer — there is no focus block
      // anywhere in the app yet, so there is nothing to count and no preference
      // to hide the line behind. Drawn rather than deferred so the hero's shape
      // is the one it will keep, and so the step doesn't gain a figure (and a
      // fifth reveal stage) on the day the timer lands.
      figure: "0",
      words: "focus blocks",
      shown: true,
    },
  ].filter((line) => line.shown);

  const heroLines: THeroLine[] = counts.map(({ key, figure, words }) => ({
    key,
    figure,
    words,
    // Every figure in `primary`, the reading the summary step takes rather than
    // the sentiment colors of the two morning reporting steps. Those are
    // flagging something that might still be wrong; this is a day already
    // lived, and marking a low count in `error` would turn a report into a
    // verdict on it.
    color: theme.colors.primary,
  }));

  // Held back until every count exists, so the sequence waits rather than
  // running against the empty placeholders the hooks serve while they resolve.
  const isLoading = habitsLoading || eventsLoading || tasksLoading;
  const reveal = useHeroReveal(isLoading ? null : date.toString());
  // **Staged at `heroLines.length`, not `BODY_STAGE`.** That constant means
  // "after all three hero lines" and is right for the two steps that always
  // draw three; this hero runs from two lines to four depending on which
  // features the reader has, so the body has to follow the list it was given.
  const bodyStyle = useStageOpacity(reveal, heroLines.length);

  // Checked *first*, and the order is load-bearing: every hook above hands back
  // an empty placeholder while its query resolves, so a cold open looks like a
  // day where nothing happened — showing the quiet-day branch ahead of this
  // would tell someone who cleared their list that they did nothing. Nothing
  // rather than a spinner, the same choice every other reporting step makes.
  if (isLoading) return null;

  // The rings are worth drawing whether or not any of them is filled: they are
  // the one interactive thing on the step, and a habit you finished after
  // dinner is exactly the kind of thing an evening review is for.
  const habitRow = preferences.enableHabits ? (
    // `showCreateNudge={false}` — a review reports on the day that happened;
    // an invitation to set up a first habit belongs on the Today tab, where
    // acting on it doesn't mean leaving a sequence half-walked.
    <HabitTracker date={date} showCreateNudge={false} />
  ) : null;

  // Nothing to list *and* no rings to tap leaves an empty box under the hero,
  // so the figures center in the step instead — the shape the backlog and open
  // tasks steps use for their own all-clear. No celebration: a day with nothing
  // closed out is a reading, not a win, and confetti would read as sarcasm.
  if (tasks.length === 0 && !habitRow) {
    return (
      <View
        style={[
          styles.quiet,
          {
            // The host SafeAreaView omits the bottom edge (the tab bar owns
            // it), so centering in the full box would sit this visibly low.
            // `HeroLines` brings the padding itself.
            paddingBottom: insets.bottom,
          },
        ]}
        testID="review-step-quiet"
      >
        <HeroLines lines={heroLines} reveal={reveal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* The body pads itself by `md` at the top, which lands under the hero —
          handed over so the block can take it back off its own bottom padding
          rather than the two stacking into a gap wider than the space above. */}
      <HeroLines
        bodyInsetTop={theme.space.md}
        lines={heroLines}
        reveal={reveal}
      />
      {/* Rings and cards under one opacity: they are two readings of the same
          finished day rather than two stages of the report, and the hero has
          already counted them off one at a time. `flex: 1` belongs to this
          wrapper so the scroll view has something to fill. Opacity only, no
          translate — `SwipeablePage`'s intro already slides the page, and a
          second axis compounds into a diagonal drift. */}
      <Animated.View style={[styles.body, bodyStyle]}>
        {habitRow}
        {/* A plain ScrollView, not a FlashList: one day's completed tasks is a
            short list, so virtualization buys nothing. Same call `DayTaskList`
            and the open tasks step both make. */}
        <ScrollView
          contentContainerStyle={{
            gap: theme.space.sm,
            paddingTop: theme.space.md,
            // The host SafeAreaView omits the bottom edge, so the inset goes on
            // the scrolling content — which also lets the last card clear the
            // translucent tab bar instead of hiding behind it.
            paddingBottom: theme.space.md + insets.bottom,
          }}
          style={styles.scroll}
        >
          {tasks.map((task) => (
            // A completed `TaskCard` is already a record rather than a handle:
            // it renders no `MoreMenu`, no rename, no due-date badge and a
            // frozen checklist (see the `isComplete` branches there), which is
            // what makes "same as today, non-interactive" one component rather
            // than a read-only variant of it. The mutations below are wired to
            // the real ones anyway — every path to them is closed on this card,
            // and stubs would rot silently if one ever opened.
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
      {/* The repeat-aware delete's prompt. Each card carries its own modal for
          its own menu's reschedules, which is unrelated to this one. */}
      <ConfirmationModal {...confirmationProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  // No gap: `HeroLines` owns the space under the hero, and the scroll view its
  // own `md` of padding above the first card.
  container: { flex: 1 },
  body: { flex: 1 },
  scroll: { flex: 1 },
  quiet: {
    flex: 1,
    justifyContent: "center",
  },
});
