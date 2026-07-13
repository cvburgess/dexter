import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { duplicateTaskInput, TTask } from "@/api/tasks";
import { CalendarView } from "@/components/CalendarView";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { DayNav } from "@/components/DayNav";
import { DayViewSwitcher, TDayView } from "@/components/DayViewSwitcher";
import { HabitTracker } from "@/components/HabitTracker";
import { JournalView } from "@/components/JournalView";
import { NotesView } from "@/components/NotesView";
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
  // Suspends notes day-swipe while the editor is focused, so horizontal drags
  // position the caret / select text instead of changing days.
  const [notesEditing, setNotesEditing] = useState(false);
  // Same for Journal: a focused response field owns horizontal drags.
  const [journalEditing, setJournalEditing] = useState(false);
  // Fall back to Tasks if the active view is disabled in settings (e.g. Notes
  // toggled off while viewing it). All views share `day.date`.
  const viewDisabled =
    (view === "notes" && !preferences.enableNotes) ||
    (view === "journal" && !preferences.enableJournal) ||
    (view === "calendar" && !preferences.enableCalendar);
  // Reset the stored `view` when its feature is disabled, so re-enabling later
  // doesn't jump back into a view the user hasn't been looking at. Adjusting
  // state during render (React's supported pattern) corrects it before paint —
  // no flash and no effect. `activeView` guards the pre-reset render pass.
  if (viewDisabled) setView("tasks");
  const activeView: TDayView = viewDisabled ? "tasks" : view;
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
        <DayNav date={day.date} onChangeDate={changeDate} />
        <View style={styles.switcher}>
          <DayViewSwitcher
            view={activeView}
            onChangeView={setView}
            enableNotes={preferences.enableNotes}
            enableJournal={preferences.enableJournal}
            enableCalendar={preferences.enableCalendar}
          />
        </View>
      </View>
      {activeView === "notes" ? (
        // Swipe to change days like tasks, but only while the note isn't being
        // edited — a focused editor owns horizontal drags for caret/selection,
        // so the gesture is suspended via `enabled` until the user taps Done.
        // SwipeableDay remounts its content per date, re-seeding the editor and
        // resetting the template chooser.
        <SwipeableDay
          dateKey={day.date.toString()}
          direction={day.direction}
          enabled={!notesEditing}
          onSwipe={changeDateBy}
        >
          <NotesView
            date={day.date.toString()}
            onEditingChange={setNotesEditing}
          />
        </SwipeableDay>
      ) : activeView === "journal" ? (
        // Swipe to change days like Notes, suspended while a response field is
        // focused so horizontal drags position the caret instead of changing
        // days. SwipeableDay remounts per date, re-seeding the response inputs.
        <SwipeableDay
          dateKey={day.date.toString()}
          direction={day.direction}
          enabled={!journalEditing}
          onSwipe={changeDateBy}
        >
          <JournalView
            date={day.date.toString()}
            onEditingChange={setJournalEditing}
          />
        </SwipeableDay>
      ) : activeView === "calendar" ? (
        // Swipe to change days like the other views. The timeline scrolls
        // vertically, so horizontal drags never conflict with its own gestures;
        // SwipeableDay remounts per date, re-fetching that day's events.
        <SwipeableDay
          dateKey={day.date.toString()}
          direction={day.direction}
          onSwipe={changeDateBy}
        >
          <CalendarView date={day.date} />
        </SwipeableDay>
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
  // DayNav spans the full width so its arrows/date stay screen-centered; the
  // compact switcher button is overlaid at the right edge (absolute) rather
  // than taking row space, which would shift DayNav off-center.
  header: {
    justifyContent: "center",
  },
  switcher: {
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 20,
    top: 0,
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
