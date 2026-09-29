import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { duplicateTaskInput, TTask } from "@/api/tasks";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { EmptyScreen } from "@/components/EmptyScreen";
import { DraggableTaskCard } from "@/components/DraggableTaskCard";
import { useTaskDelete } from "@/hooks/useTaskDelete";
import { useTasks } from "@/hooks/useTasks";
import { useTheme } from "@/utils/theme";

type TTaskCardListProps = {
  tasks: TTask[];
  /** Shown when `tasks` is empty; `null` renders nothing — what kanban
   * columns want, since a row of empty-state messages reads as noise. */
  emptyMessage: string | null;
};

// A scrolling column of task cards plus the repeat-aware delete confirmation,
// shared by Week's day columns (DEX-96) and the Lists tab (DEX-221).
export function TaskCardList({ tasks, emptyMessage }: TTaskCardListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [, { isLoading, updateTask, createTask }] = useTasks();
  // Lives in the hook so Open tasks shares it (DEX-146) — a second copy could
  // drop a repeat schedule on one surface and keep it on the other.
  const { confirmDelete, confirmationProps } = useTaskDelete();

  return (
    <>
      {/* Plain ScrollView: cards' @expo/ui menu hosts size async, which
          virtualization worsens (expo/expo#42576). Empty state renders inside it (DEX-136). */}
      <ScrollView
        showsVerticalScrollIndicator={false}
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
              // Draggable only under a DragScheduleProvider (Week and Lists
              // columns, Today's Tasks pane); a plain TaskCard elsewhere (DEX-77).
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
  // Bound the scroll view's height to its flex parent so the tasks scroll
  // when they overflow, instead of being clipped.
  scroll: {
    flex: 1,
  },
});
