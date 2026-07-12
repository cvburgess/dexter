import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { duplicateTaskInput, TTask } from "@/api/tasks";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { DayNav } from "@/components/DayNav";
import { DayViewSwitcher, TDayView } from "@/components/DayViewSwitcher";
import { HabitTracker } from "@/components/HabitTracker";
import { NotesView } from "@/components/NotesView";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";
import { SwipeableDay } from "@/components/SwipeableDay";
import { TaskCard } from "@/components/TaskCard";
import { useConfirmation } from "@/hooks/useConfirmation";
import { usePreferences } from "@/hooks/usePreferences";
import {
  taskFiltersForDate,
  usePrefetchAdjacentTasks,
  useTasks,
} from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import { useTheme } from "@/utils/theme";

type TDayState = {
  date: Temporal.PlainDate;
  direction: -1 | 0 | 1;
};

export default function TodayScreen() {
  const theme = useTheme();
  const { confirm, confirmationProps } = useConfirmation();
  const [preferences] = usePreferences();
  const [day, setDay] = useState<TDayState>(() => ({
    date: Temporal.Now.plainDateISO(),
    direction: 0,
  }));
  const [view, setView] = useState<TDayView>("tasks");
  // Fall back to Tasks if the active view is disabled in settings (e.g. Notes
  // toggled off while viewing it). All views share `day.date`.
  const activeView: TDayView =
    (view === "notes" && !preferences.enableNotes) ||
    (view === "journal" && !preferences.enableJournal)
      ? "tasks"
      : view;
  const [tasks, { isLoading, updateTask, createTask, deleteTask }] = useTasks({
    filters: taskFiltersForDate(day.date),
  });
  const [, { deleteTemplate }] = useTemplates();
  usePrefetchAdjacentTasks(day.date);
  // So "New Task" opened from this tab defaults its schedule to the viewed day.
  usePublishViewedDay(day.date);

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

  const changeDate = (next: Temporal.PlainDate) =>
    setDay(({ date }) => ({
      date: next,
      direction: Temporal.PlainDate.compare(next, date),
    }));

  const changeDateBy = (days: 1 | -1) =>
    setDay(({ date }) => {
      const next = date.add({ days });
      return { date: next, direction: Temporal.PlainDate.compare(next, date) };
    });

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <View style={styles.dayNavWrap}>
          <DayNav date={day.date} onChangeDate={changeDate} />
        </View>
        <DayViewSwitcher
          view={activeView}
          onChangeView={setView}
          enableNotes={preferences.enableNotes}
          enableJournal={preferences.enableJournal}
        />
      </View>
      {activeView === "notes" ? (
        // Keyed by date so switching days remounts the editor (re-seeds the
        // note, resets the template chooser). Notes navigate via DayNav only —
        // no swipe, which would fight the editor's caret/selection gestures.
        <NotesView key={day.date.toString()} date={day.date.toString()} />
      ) : activeView === "journal" ? (
        <PlaceholderScreen message="Journal is coming soon." />
      ) : (
        <SwipeableDay
          dateKey={day.date.toString()}
          direction={day.direction}
          onSwipe={changeDateBy}
        >
          {preferences.enableHabits && <HabitTracker date={day.date} />}
          {/* A plain ScrollView (not FlatList): a day's list is small, so
              virtualization buys nothing — and the cards contain @expo/ui menu
              hosts that size asynchronously, which virtualized off-viewport
              mounting makes worse (expo/expo#42576). The cards themselves pin
              their heights (see TaskCard/StatusButton) so layout stays stable. */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
            {tasks.length === 0
              ? !isLoading && (
                  <Text
                    style={[
                      styles.emptyText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    No tasks scheduled for this day.
                  </Text>
                )
              : tasks.map((item) => (
                  <TaskCard
                    key={item.id}
                    task={item}
                    onUpdate={(diff) => updateTask({ id: item.id, ...diff })}
                    onDuplicate={() => createTask(duplicateTaskInput(item))}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
          </ScrollView>
        </SwipeableDay>
      )}
      <ConfirmationModal {...confirmationProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // DayNav takes the row's flexible space and centers its own content; the
  // switcher sits inline at the right edge (DayNav ends up slightly left of
  // dead-center, which reads fine and avoids overlapping its arrows).
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingRight: 12,
  },
  dayNavWrap: {
    flex: 1,
  },
  // Bound the scroll view's height to its flex parent so the day's tasks
  // scroll when they overflow, instead of being clipped.
  scroll: {
    flex: 1,
  },
  list: {
    gap: 8,
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    paddingTop: 32,
    textAlign: "center",
  },
});
