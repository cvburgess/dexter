import { Temporal } from "@js-temporal/polyfill";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CalendarView } from "@/components/CalendarView";
import { DayNav } from "@/components/DayNav";
import { DayViewSwitcher, TDayView } from "@/components/DayViewSwitcher";
import { JournalView } from "@/components/JournalView";
import { NotesView } from "@/components/NotesView";
import { SwipeableDay } from "@/components/SwipeableDay";
import {
  TaskDrawerSheet,
  TTaskDrawerSheetHandle,
} from "@/components/TaskDrawerSheet";
import { TasksView } from "@/components/TasksView";
import { TPreferences } from "@/api/preferences";
import { TFilterId } from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

type TSmallScreenTodayProps = {
  date: Temporal.PlainDate;
  direction: -1 | 0 | 1;
  preferences: TPreferences;
  changeDate: (next: Temporal.PlainDate) => void;
  changeDateBy: (days: 1 | -1) => void;
  // The Filter preset to pre-apply when opening Backlog (Overdue/left-behind),
  // or null when there's nothing needing attention. Drives the switcher's dot.
  attentionFilter: TFilterId | null;
};

// The single-view (small-screen) Today layout: one full-width view at a time
// with a switcher, day navigation, and a swipe-to-change-day gesture. Owns the
// state that only this layout needs (`view`/editing flags/the drawer sheet);
// the large-screen multi-pane layout lives in `LargeScreenToday`.
export function SmallScreenToday({
  date,
  direction,
  preferences,
  changeDate,
  changeDateBy,
  attentionFilter,
}: TSmallScreenTodayProps) {
  const theme = useTheme();
  const backlogAttention = attentionFilter !== null;
  const [view, setView] = useState<TDayView>("tasks");
  // Suspends notes day-swipe while the editor is focused, so horizontal drags
  // position the caret / select text instead of changing days.
  const [notesEditing, setNotesEditing] = useState(false);
  // Same for Journal: a focused response field owns horizontal drags.
  const [journalEditing, setJournalEditing] = useState(false);
  const taskDrawerRef = useRef<TTaskDrawerSheetHandle>(null);

  // Fall back to Tasks if the active view is disabled in settings (e.g. Notes
  // toggled off while viewing it). All views share `date`.
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

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <DayNav date={date} onChangeDate={changeDate} />
        <View style={styles.switcher}>
          {/* The task-drawer trigger lives inside this menu (via onOpenDrawer)
              rather than as a second header button — a standalone button here
              crowded DayNav's next-day arrow. */}
          <DayViewSwitcher
            view={activeView}
            onChangeView={setView}
            onOpenDrawer={() =>
              taskDrawerRef.current?.present(attentionFilter ?? undefined)
            }
            attention={backlogAttention}
            enableNotes={preferences.enableNotes}
            enableJournal={preferences.enableJournal}
            enableCalendar={preferences.enableCalendar}
          />
        </View>
      </View>
      <DayViewContent
        view={activeView}
        date={date}
        direction={direction}
        notesEditing={notesEditing}
        journalEditing={journalEditing}
        onNotesEditingChange={setNotesEditing}
        onJournalEditingChange={setJournalEditing}
        onSwipe={changeDateBy}
      />
      <TaskDrawerSheet ref={taskDrawerRef} date={date} />
    </SafeAreaView>
  );
}

type TDayViewContentProps = {
  view: TDayView;
  date: Temporal.PlainDate;
  direction: -1 | 0 | 1;
  notesEditing: boolean;
  journalEditing: boolean;
  onNotesEditingChange: (editing: boolean) => void;
  onJournalEditingChange: (editing: boolean) => void;
  onSwipe: (days: 1 | -1) => void;
};

// Swipe to change days, suspended while a note/journal response field is
// focused — a focused editor owns horizontal drags for caret/selection until
// the user taps Done. Calendar and Tasks have no such conflict (Calendar's
// timeline scrolls vertically) and always allow swiping. SwipeableDay
// remounts its content per date, re-seeding editors/inputs and re-fetching
// calendar events.
function DayViewContent({
  view,
  date,
  direction,
  notesEditing,
  journalEditing,
  onNotesEditingChange,
  onJournalEditingChange,
  onSwipe,
}: TDayViewContentProps) {
  return (
    <SwipeableDay
      dateKey={date.toString()}
      direction={direction}
      enabled={
        view === "notes"
          ? !notesEditing
          : view === "journal"
            ? !journalEditing
            : undefined
      }
      onSwipe={onSwipe}
    >
      {view === "notes" ? (
        <NotesView
          date={date.toString()}
          onEditingChange={onNotesEditingChange}
        />
      ) : view === "journal" ? (
        <JournalView
          date={date.toString()}
          onEditingChange={onJournalEditingChange}
        />
      ) : view === "calendar" ? (
        <CalendarView date={date} />
      ) : (
        <TasksView date={date} />
      )}
    </SwipeableDay>
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
    alignItems: "center",
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    position: "absolute",
    right: 20,
    top: 0,
  },
});
