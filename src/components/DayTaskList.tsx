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
  /**
   * Shown in place of the list when the day has no tasks. `null` renders
   * nothing at all — what the Week tab's columns want, since seven empty-state
   * messages side by side read as noise rather than information (DEX-96).
   */
  emptyMessage?: string | null;
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
}: TDayTaskListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [allTasks, { isLoading, updateTask, createTask }] = useTasks();
  const tasks = useMemo(
    () => selectTasksForDate(allTasks, date),
    [allTasks, date],
  );
  // The repeat-aware delete lives in the hook so the ritual's Open tasks step
  // shares it (DEX-146) — a second copy could drop a repeat schedule on one
  // surface and keep it on the other.
  const { confirmDelete, confirmationProps } = useTaskDelete();

  return (
    <>
      {/* A plain ScrollView (not FlatList): a day's list is small, so
          virtualization buys nothing — and the cards contain @expo/ui menu
          hosts that size asynchronously, which virtualized off-viewport
          mounting makes worse (expo/expo#42576). The cards themselves pin
          their heights (see TaskCard/StatusButton) so layout stays stable.

          It is also rendered unconditionally, with the empty state *inside* it
          rather than in its place (DEX-136). UIKit resolves a tab screen's
          content scroll view once, when the screen mounts, by walking first
          subviews — so a day that happens to be empty at that moment used to
          leave the tab bar with no scroll view to minimize against for the
          life of the screen. See docs/frontend.md, "Safe areas and keyboard". */}
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
        // while still letting the last card scroll fully clear of it.
        //
        // The empty state takes `flexGrow` and none of that padding instead:
        // `EmptyScreen` is a `flex: 1` centred box that reserves the same
        // inset itself, so adding the list's would centre it against a box
        // that has already been shortened once and sit it visibly high.
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
              // Draggable only where a `DragScheduleProvider` is above it — the
              // Week columns and Today's Tasks pane. Everywhere else this is a
              // plain TaskCard (DEX-77).
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
