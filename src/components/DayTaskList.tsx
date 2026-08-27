import { Temporal } from "@js-temporal/polyfill";
import { useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { duplicateTaskInput } from "@/api/tasks";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { EmptyScreen } from "@/components/EmptyScreen";
import { DraggableTaskCard } from "@/components/DraggableTaskCard";
import { useTaskDelete } from "@/hooks/useTaskDelete";
import { useTasks } from "@/hooks/useTasks";
import { selectTasksForDate } from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

type TDayTaskListProps = {
  date: Temporal.PlainDate;
  /** Shown for an empty day; `null` renders nothing — what Week's columns
   * want, since seven empty-state messages side by side read as noise. */
  emptyMessage?: string | null;
};

// One day's task list plus the repeat-aware delete confirmation, no habit
// row or header — extracted so Week's day columns (DEX-96) share it.
export function DayTaskList({
  date,
  emptyMessage = "No tasks scheduled for this day.",
}: TDayTaskListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [allTasks, { isLoading, updateTask, createTask }] = useTasks();
  const tasks = useMemo(
    () => selectTasksForDate(allTasks, date),
    [allTasks, date],
  );
  // Lives in the hook so Open tasks shares it (DEX-146) — a second copy could
  // drop a repeat schedule on one surface and keep it on the other.
  const { confirmDelete, confirmationProps } = useTaskDelete();

  return (
    <>
      {/* Plain ScrollView: cards' @expo/ui menu hosts size async, which
          virtualization worsens (expo/expo#42576). Empty state renders inside it (DEX-136). */}
      <ScrollView
        style={styles.scroll}
        // Vertical only — the gutter belongs to whoever placed this list
        // (docs/design.md); content, not container, gets the bottom inset.
        contentContainerStyle={
          tasks.length === 0
            ? styles.emptyContent
            : {
                gap: theme.space.sm,
                paddingTop: theme.space.md,
                paddingBottom: theme.space.md + insets.bottom,
              }
        }
      >
        {tasks.length === 0
          ? !isLoading &&
            emptyMessage !== null && <EmptyScreen message={emptyMessage} />
          : tasks.map((item) => (
              // Draggable only under a DragScheduleProvider (Week columns,
              // Today's Tasks pane); a plain TaskCard elsewhere (DEX-77).
              <DraggableTaskCard
                key={item.id}
                task={item}
                onUpdate={(diff) => updateTask({ id: item.id, ...diff })}
                onDuplicate={() => createTask(duplicateTaskInput(item))}
                onPromoteSubtask={(promoted) => createTask(promoted)}
                onDelete={() => void confirmDelete(item)}
              />
            ))}
      </ScrollView>
      <ConfirmationModal {...confirmationProps} />
    </>
  );
}

const styles = StyleSheet.create({
  // Lets the empty state fill the viewport so it centres in it, which a content
  // container sized to its (empty) content would not.
  emptyContent: {
    flexGrow: 1,
  },
  // Bound the scroll view's height to its flex parent so the day's tasks
  // scroll when they overflow, instead of being clipped.
  scroll: {
    flex: 1,
  },
});
