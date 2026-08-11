import { Temporal } from "@js-temporal/polyfill";
import { ReactNode, useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { duplicateTaskInput, TTask } from "@/api/tasks";
import { isRepeatTask } from "@/api/templates";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { EmptyScreen } from "@/components/EmptyScreen";
import { DraggableTaskCard } from "@/components/DraggableTaskCard";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { selectTasksForDate } from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

type TDayTaskListProps = {
  date: Temporal.PlainDate;
  /**
   * Shown in place of the list when the day has no tasks. `null` renders
   * nothing at all — what the Week tab's columns want, since seven empty-state
   * messages side by side read as noise rather than information (DEX-96).
   */
  emptyMessage?: string | null;
  /**
   * Rendered under `emptyMessage`, inside the same empty state — the ritual's
   * Tasks step points at the global "＋ New Task" button from here (DEX-144).
   *
   * Separate from `emptyMessage` rather than folded into it as a second
   * paragraph because `EmptyScreen` already has the seam (its `children`,
   * spaced by `space.sm`), and a caller that wants a real control there rather
   * than a line of prose can pass one without this prop changing shape.
   * Ignored, like the message, when `emptyMessage` is `null`.
   */
  emptyAction?: ReactNode;
};

/**
 * One day's task list — the scrolling card list plus the repeat-aware delete
 * confirmation, with no habit row and no header of its own.
 *
 * Extracted from `TasksView` so the Week tab's day columns (DEX-96) get the
 * same list without re-deriving the delete flow, which has to know that a
 * linked template may be a repeat schedule (delete it) or a saved task
 * template (keep it). `TasksView` is now this plus `HabitTracker`.
 */
export function DayTaskList({
  date,
  emptyMessage = "No tasks scheduled for this day.",
  emptyAction,
}: TDayTaskListProps) {
  const { confirm, confirmationProps } = useConfirmation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [allTasks, { isLoading, updateTask, createTask, deleteTask }] =
    useTasks();
  const tasks = useMemo(
    () => selectTasksForDate(allTasks, date),
    [allTasks, date],
  );
  const [, { deleteTemplate, getTemplateById }] = useTemplates();

  const handleDelete = async (task: TTask) => {
    // A linked template is only this task's repeat schedule while it still
    // carries one. Since DEX-65 it may have been converted into a saved task
    // template — which is the user's, not this task's, and must outlive it.
    // Unknown (still loading, stale id) counts as "not a repeat": leaving a
    // schedule behind is visible and undoable in Settings, whereas deleting a
    // template the user saved is neither.
    const linkedTemplate = getTemplateById(task.templateId);
    const isRepeating = linkedTemplate ? isRepeatTask(linkedTemplate) : false;
    const confirmed = await confirm({
      title: isRepeating ? "Delete repeating task?" : "Delete Task",
      message: isRepeating
        ? "This task repeats. Deleting it also removes its repeat schedule, so no new occurrences will be created."
        : "Delete this task?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    // The task→template FK is ON DELETE SET NULL, so the template must be removed
    // explicitly to stop future occurrences (DEX-21).
    if (isRepeating && task.templateId) deleteTemplate(task.templateId);
    deleteTask(task.id);
  };

  return (
    <>
      {/* A plain ScrollView (not FlatList): a day's list is small, so
          virtualization buys nothing — and the cards contain @expo/ui menu
          hosts that size asynchronously, which virtualized off-viewport
          mounting makes worse (expo/expo#42576). The cards themselves pin
          their heights (see TaskCard/StatusButton) so layout stays stable. */}
      {tasks.length === 0 ? (
        !isLoading &&
        emptyMessage !== null && (
          <EmptyScreen message={emptyMessage}>{emptyAction}</EmptyScreen>
        )
      ) : (
        <ScrollView
          style={styles.scroll}
          // Vertical only — the side gutter belongs to whoever placed this list
          // (see docs/design.md, "Who owns spacing"). The phone gets one from
          // `SwipeablePage`; the Today pane and the Week columns want none, and
          // a gutter per column would stack with its neighbour's and double
          // every gap in the grid (DEX-96).
          //
          // The host SafeAreaView omits the bottom edge (the native tab bar
          // owns it — see SmallScreenToday/LargeScreenToday/WeekView), so the
          // list adds that inset to its own padding here. Padding the content
          // rather than the container keeps cards scrolling *under* the
          // translucent bar — what `minimizeBehavior="onScrollDown"` (see
          // `(tabs)/_layout.tsx`) needs in order to have anything to reveal —
          // while still letting the last card scroll fully clear of it. Same
          // shape as EmptyScreen's own inset, so the list and the empty state
          // that replaces it land on the same baseline.
          contentContainerStyle={{
            gap: theme.space.sm,
            paddingTop: theme.space.md,
            paddingBottom: theme.space.md + insets.bottom,
          }}
        >
          {tasks.map((item) => (
            // Draggable only where a `DragScheduleProvider` is above it — the
            // Week columns and Today's Tasks pane. Everywhere else this is a
            // plain TaskCard (DEX-77).
            <DraggableTaskCard
              key={item.id}
              task={item}
              onUpdate={(diff) => updateTask({ id: item.id, ...diff })}
              onDuplicate={() => createTask(duplicateTaskInput(item))}
              onPromoteSubtask={(promoted) => createTask(promoted)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </ScrollView>
      )}
      <ConfirmationModal {...confirmationProps} />
    </>
  );
}

const styles = StyleSheet.create({
  // Bound the scroll view's height to its flex parent so the day's tasks
  // scroll when they overflow, instead of being clipped.
  scroll: {
    flex: 1,
  },
});
