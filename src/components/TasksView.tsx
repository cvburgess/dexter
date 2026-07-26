import { Temporal } from "@js-temporal/polyfill";
import { useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { duplicateTaskInput, TTask } from "@/api/tasks";
import { isRepeatTask } from "@/api/templates";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { EmptyScreen } from "@/components/EmptyScreen";
import { HabitTracker } from "@/components/HabitTracker";
import { TaskCard } from "@/components/TaskCard";
import { useConfirmation } from "@/hooks/useConfirmation";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { selectTasksForDate } from "@/utils/taskFilters";

type TTasksViewProps = {
  date: Temporal.PlainDate;
};

/**
 * Habits + the day's task list for `date` — the always-visible pane of the
 * Today tab. Composable so it can be shown alone (small screens) or beside
 * other panes (large screens); see `today/index.tsx`.
 */
export function TasksView({ date }: TTasksViewProps) {
  const { confirm, confirmationProps } = useConfirmation();
  const [preferences] = usePreferences();
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
      {preferences.enableHabits && <HabitTracker date={date} />}
      {/* A plain ScrollView (not FlatList): a day's list is small, so
          virtualization buys nothing — and the cards contain @expo/ui menu
          hosts that size asynchronously, which virtualized off-viewport
          mounting makes worse (expo/expo#42576). The cards themselves pin
          their heights (see TaskCard/StatusButton) so layout stays stable. */}
      {tasks.length === 0 ? (
        !isLoading && <EmptyScreen message="No tasks scheduled for this day." />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
          {tasks.map((item) => (
            <TaskCard
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
  list: {
    gap: 8,
    padding: 16,
  },
});
