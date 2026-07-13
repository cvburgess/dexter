import { Temporal } from "@js-temporal/polyfill";
import { ScrollView, StyleSheet } from "react-native";

import { duplicateTaskInput, TTask } from "@/api/tasks";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { EmptyScreen } from "@/components/EmptyScreen";
import { HabitTracker } from "@/components/HabitTracker";
import { TaskCard } from "@/components/TaskCard";
import { useConfirmation } from "@/hooks/useConfirmation";
import { usePreferences } from "@/hooks/usePreferences";
import { taskFiltersForDate, useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";

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
  const [tasks, { isLoading, updateTask, createTask, deleteTask }] = useTasks({
    filters: taskFiltersForDate(date),
  });
  const [, { deleteTemplate }] = useTemplates();

  const handleDelete = async (task: TTask) => {
    const isRepeating = task.templateId !== null;
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
    if (task.templateId) deleteTemplate(task.templateId);
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
