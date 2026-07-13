import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CalendarView } from "@/components/CalendarView";
import { DayNav } from "@/components/DayNav";
import { DayPaneToggles } from "@/components/DayPaneToggles";
import { DayViewSwitcher, TDayView } from "@/components/DayViewSwitcher";
import { JournalView } from "@/components/JournalView";
import { NotesView } from "@/components/NotesView";
import { SwipeableDay } from "@/components/SwipeableDay";
import { TasksView } from "@/components/TasksView";
import { usePreferences } from "@/hooks/usePreferences";
import { usePrefetchAdjacentTasks } from "@/hooks/useTasks";
import { useTodayPanes } from "@/hooks/useTodayPanes";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import { PANE_MAX_WIDTH, TWO_PANE_MIN_WIDTH } from "@/utils/breakpoints";
import { useTheme } from "@/utils/theme";

type TDayState = {
  date: Temporal.PlainDate;
  direction: -1 | 0 | 1;
};

export default function TodayScreen() {
  const theme = useTheme();
  const [preferences] = usePreferences();
  const { width } = useWindowDimensions();
  const multiPane = width >= TWO_PANE_MIN_WIDTH;
  const [panes, { togglePane }] = useTodayPanes();
  const [day, setDay] = useState<TDayState>(() => ({
    date: Temporal.Now.plainDateISO(),
    direction: 0,
  }));
  const [view, setView] = useState<TDayView>("tasks");
  // Suspends notes day-swipe while the editor is focused, so horizontal drags
  // position the caret / select text instead of changing days. Only relevant
  // to the small-screen single-view layout — large screens don't swipe.
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
  usePrefetchAdjacentTasks(day.date);
  // So "New Task" opened from this tab defaults its schedule to the viewed day.
  usePublishViewedDay(day.date);

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

  if (multiPane) {
    const showNotes = preferences.enableNotes && panes.notes;
    const showJournal = preferences.enableJournal && panes.journal;
    const showCalendar = preferences.enableCalendar && panes.calendar;

    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.multiPaneHeader}>
          <DayNav date={day.date} onChangeDate={changeDate} />
          <DayPaneToggles
            enableCalendar={preferences.enableCalendar}
            enableJournal={preferences.enableJournal}
            enableNotes={preferences.enableNotes}
            onTogglePane={togglePane}
            panes={panes}
          />
        </View>
        <View style={[styles.paneRow, { gap: theme.gap }]}>
          <View style={styles.fixedPane}>
            <TasksView date={day.date} />
          </View>
          {showNotes && (
            <View style={styles.flexPane}>
              <NotesView date={day.date.toString()} />
            </View>
          )}
          {showJournal && (
            <View style={styles.flexPane}>
              <JournalView date={day.date.toString()} />
            </View>
          )}
          {showCalendar && (
            <View style={styles.fixedPane}>
              <CalendarView date={day.date} />
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

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
          <TasksView date={day.date} />
        </SwipeableDay>
      )}
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
  // Large screens: DayNav sits left, pane toggles sit right, sharing a row
  // (unlike the small-screen header, nothing needs absolute positioning
  // because there's no need to keep DayNav visually centered).
  multiPaneHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  paneRow: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
  },
  // Tasks and Calendar are capped at a mobile-typical width so they don't
  // stretch to fill a wide window.
  fixedPane: {
    flex: 1,
    maxWidth: PANE_MAX_WIDTH,
    minWidth: 280,
  },
  // Notes and Journal flex to fill whatever space remains.
  flexPane: {
    flex: 1,
  },
});
