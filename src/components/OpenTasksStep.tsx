import { Temporal } from "@js-temporal/polyfill";
import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import {
  duplicateTaskInput,
  TCreateTask,
  TTask,
  TUpdateTask,
} from "@/api/tasks";
import { Confetti } from "@/components/Confetti";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { TaskScheduleButton } from "@/components/TaskScheduleButton";
import {
  HeroLines,
  type THeroLine,
  useHeroReveal,
  useStageOpacity,
} from "@/components/HeroLines";
import { TaskCard } from "@/components/TaskCard";
import { useScheduleChange } from "@/hooks/useScheduleChange";
import { useTaskDelete } from "@/hooks/useTaskDelete";
import { useTasks } from "@/hooks/useTasks";
import { selectOpenTasksForDate } from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

type TOpenTaskRowProps = {
  task: TTask;
  /** The day being closed out; the buttons derive their own targets from it. */
  date: Temporal.PlainDate;
  onChangeSchedule: (task: TTask, scheduledFor: string | null) => void;
  onDelete: (task: TTask) => void;
  onEditingChange: (editing: boolean) => void;
  /** Bound to this row's task by the parent, the way the drawer binds its rows. */
  onUpdate: (diff: Omit<TUpdateTask, "id">) => void;
  onCreate: (task: TCreateTask) => void;
};

/**
 * One task, between its two dispositions.
 *
 * The same shape the backlog drawer's rows take — a card in a `flex: 1` wrapper
 * with a `TaskScheduleButton` beside it — mirrored so this one has a button on
 * each side. Both are `solid`: liquid glass cannot sample its backdrop through
 * the fade `SwipeablePage` runs over every ritual step, so the glass circles
 * washed out here and left two bare glyphs beside the card.
 */
function OpenTaskRow({
  task,
  date,
  onChangeSchedule,
  onDelete,
  onEditingChange,
  onUpdate,
  onCreate,
}: TOpenTaskRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { gap: theme.space.sm }]}>
      <TaskScheduleButton
        date={date}
        mode="unschedule"
        onChangeSchedule={onChangeSchedule}
        solid
        task={task}
      />
      <View style={styles.cardWrapper}>
        {/* A plain `TaskCard`, not `DraggableTaskCard`: there is no
            `DragScheduleProvider` above the ritual, where that wrapper degrades
            to exactly this — and it claims `onEditingChange` for its own drag
            gate, which this step needs in order to suspend the step swipe. */}
        <TaskCard
          onDelete={() => onDelete(task)}
          onDuplicate={() => onCreate(duplicateTaskInput(task))}
          onEditingChange={onEditingChange}
          onPromoteSubtask={onCreate}
          onUpdate={onUpdate}
          task={task}
        />
      </View>
      <TaskScheduleButton
        date={date}
        mode="defer"
        onChangeSchedule={onChangeSchedule}
        solid
        task={task}
      />
    </View>
  );
}

type TOpenTasksStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
  /** Suspends the step swipe while a card's title is being renamed in place. */
  onEditingChange: (editing: boolean) => void;
};

/**
 * The evening ritual's opening step (DEX-146): what is still open on the day
 * being closed out, and the two ways to put it down.
 *
 * **This is not the morning task-list step DEX-144 removed.** That one copied
 * the Today list into the ritual without being able to replace it, leaving two
 * lists of the same day a swipe apart. This one differs on the axis that
 * mattered: the evening ritual has no other task surface to duplicate, and every
 * row here exists to be *dispatched* — pushed to tomorrow or dropped off the
 * calendar — rather than browsed. The list empties as you work it, which is the
 * whole step, and a day you have finished ends in the all-clear below. Reach for
 * both histories before re-proposing either.
 *
 * The hero and the rows read the one `useTasks()` query, so dispatching a task
 * drops it from the count and the list in the same render.
 *
 * Carries no side gutter and no top inset of its own; `SwipeablePage` and the
 * ritual layouts own those (see docs/design.md, "Who owns spacing").
 */
export function OpenTasksStep({ date, onEditingChange }: TOpenTasksStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Read once here and bound per row below — the shape `TaskDrawer` and
  // `DayTaskList` both take. Calling `useTasks()` inside the row instead would
  // add a query observer and a set of mutations per task on screen.
  const [allTasks, { isLoading, updateTask, createTask }] = useTasks();
  // Every `scheduledFor` write goes through here rather than straight to
  // `updateTask` (DEX-77): an alarm is bound to the task's scheduled date, so
  // both buttons owe the same prompt the card's own menu gives. This is the bug
  // the hook exists to prevent — the backlog's "+" once wrote through and left
  // alarms pointing at the old day.
  const { changeSchedule, confirmationProps } = useScheduleChange(updateTask);
  const { confirmDelete, confirmationProps: deleteConfirmationProps } =
    useTaskDelete();

  const tasks = useMemo(
    () => selectOpenTasksForDate(allTasks, date),
    [allTasks, date],
  );

  // Held back until the tasks exist, so the sequence waits rather than running
  // against `useTasks`'s empty placeholder array.
  const reveal = useHeroReveal(isLoading ? null : date.toString());

  const count = tasks.length;
  const heroLines: THeroLine[] = [
    {
      key: "open",
      figure: String(count),
      words: `open ${count === 1 ? "task" : "tasks"}`,
      // A zero here is the good news the step is working toward, so it takes
      // `success` — the same reading the backlog step's cleared buckets get.
      // Anything above it is work still to place, not a failure: `primary`,
      // not `error`.
      color: count === 0 ? theme.colors.success : theme.colors.primary,
    },
  ];

  // **Staged at `heroLines.length`, not `BODY_STAGE`.** That constant means
  // "after all three hero lines" and is right for the two steps that always draw
  // three; this one draws one, and waiting for stage 3 would leave the list
  // missing for most of a 3.6s sequence (the lesson `SummaryStep` records).
  const listStyle = useStageOpacity(reveal, heroLines.length);

  // Checked *first*, and the order is load-bearing: `useTasks` hands back an
  // empty placeholder array while the query resolves, so the day looks finished
  // on every cold open — testing the all-clear ahead of this would throw
  // confetti at someone whose evening is full. Nothing rather than a spinner,
  // the same choice the calendar and backlog steps make: one quick read, and a
  // spinner that appears for a frame reads as the step failing.
  if (isLoading) return null;

  if (count === 0) {
    return (
      <View
        style={[
          styles.allClear,
          {
            // The host SafeAreaView omits the bottom edge (the tab bar owns
            // it), so centering in the full box would sit this visibly low —
            // the same reservation `EmptyScreen` and the backlog step's clear
            // state make. `HeroLines` brings the padding itself.
            paddingBottom: insets.bottom,
          },
        ]}
        testID="open-tasks-step-clear"
      >
        {/* Behind the figure, and only reachable once the count has actually
            resolved to zero — see the `isLoading` guard above. */}
        <Confetti revealKey={date.toString()} />
        <HeroLines lines={heroLines} reveal={reveal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* The list pads itself by `md` at the top, which lands under the hero —
          handed over so the block can take it back off its own bottom padding
          rather than the two stacking into a gap wider than the space above. */}
      <HeroLines
        bodyInsetTop={theme.space.md}
        lines={heroLines}
        reveal={reveal}
      />
      {/* `flex: 1` belongs to this wrapper so the scroll view has something to
          fill. Opacity only, no translate — `SwipeablePage`'s intro already
          slides the page, and a second axis compounds into a diagonal drift. */}
      <Animated.View style={[styles.list, listStyle]}>
        {/* A plain ScrollView, not a FlashList: one day's open tasks is a short
            list, so virtualization buys nothing — and each card carries several
            `@expo/ui` menu hosts that size asynchronously, which off-viewport
            mounting makes worse. Same call `DayTaskList` makes. */}
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
            <OpenTaskRow
              key={task.id}
              date={date}
              onChangeSchedule={(target, scheduledFor) =>
                void changeSchedule(target, scheduledFor)
              }
              onCreate={createTask}
              onDelete={(target) => void confirmDelete(target)}
              onEditingChange={onEditingChange}
              onUpdate={(diff) => updateTask({ id: task.id, ...diff })}
              task={task}
            />
          ))}
        </ScrollView>
      </Animated.View>
      {/* Both prompts this step owns: the two buttons' alarm confirmation, and
          the card menu's repeat-aware delete. Each card carries its own modal
          for its own menu's reschedules, which is unrelated to these. */}
      <ConfirmationModal {...confirmationProps} />
      <ConfirmationModal {...deleteConfirmationProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  // No gap: `HeroLines` owns the space under the hero, and the scroll view its
  // own `md` of padding above the first card.
  container: { flex: 1 },
  list: { flex: 1 },
  scroll: { flex: 1 },
  allClear: {
    flex: 1,
    justifyContent: "center",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
  cardWrapper: {
    flex: 1,
  },
});
