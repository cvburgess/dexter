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

// Backlog drawer's row shape, mirrored for a button on each side. Both are
// `solid` — glass can't sample through SwipeablePage's fade and washes out.
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
        {/* Plain TaskCard, not DraggableTaskCard — no DragScheduleProvider
            above the ritual, and this step needs onEditingChange itself. */}
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

// Evening ritual's opening step (DEX-146): every row is meant to be
// dispatched, not browsed — the list empties as you work it.
export function OpenTasksStep({ date, onEditingChange }: TOpenTasksStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Read once and bound per row, like TaskDrawer/DayTaskList — a per-row
  // useTasks() would add a query observer and mutation set per task.
  const [allTasks, { isLoading, updateTask, createTask }] = useTasks();
  // Not straight to updateTask (DEX-77) — both buttons owe the alarm prompt
  // the card's own menu gives, the bug the backlog's "+" once shipped.
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
      // Zero is the good news this step works toward — success, not error.
      color: count === 0 ? theme.colors.success : theme.colors.primary,
    },
  ];

  // Staged at heroLines.length, not BODY_STAGE — this hero draws only one line.
  const listStyle = useStageOpacity(reveal, heroLines.length);

  // Checked first: useTasks serves an empty placeholder while resolving,
  // which would otherwise throw confetti at a full evening.
  if (isLoading) return null;

  if (count === 0) {
    return (
      <View
        style={[
          styles.allClear,
          // Host SafeAreaView omits the bottom edge, same reservation
          // EmptyScreen and the backlog step's clear state make.
          { paddingBottom: insets.bottom },
        ]}
        testID="open-tasks-step-clear"
      >
        {/* Only reachable once the count resolves to zero — see isLoading above. */}
        <Confetti revealKey={date.toString()} />
        <HeroLines lines={heroLines} reveal={reveal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* bodyInsetTop hands `md` to the list wrapper, which pays it back as
          its own top padding rather than stacking a second gap. */}
      <HeroLines
        bodyInsetTop={theme.space.md}
        lines={heroLines}
        reveal={reveal}
      />
      {/* Opacity only, no translate — SwipeablePage's intro already slides. */}
      <Animated.View style={[styles.list, listStyle]}>
        {/* Plain ScrollView, not FlashList — short list, and off-viewport
            mounting would worsen each card's async-sizing menu hosts. */}
        <ScrollView
          contentContainerStyle={{
            gap: theme.space.sm,
            paddingTop: theme.space.md,
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
      {/* The buttons' alarm confirmation and the card menu's repeat-aware
          delete; unrelated to each card's own reschedule modal. */}
      <ConfirmationModal {...confirmationProps} />
      <ConfirmationModal {...deleteConfirmationProps} />
    </View>
  );
}

const styles = StyleSheet.create({
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
