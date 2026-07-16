import type { BottomSheetMethods } from "@expo/ui/community/bottom-sheet";
import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CalendarView } from "@/components/CalendarView";
import { DayNav } from "@/components/DayNav";
import { DayPaneToggles } from "@/components/DayPaneToggles";
import { DayViewSwitcher, TDayView } from "@/components/DayViewSwitcher";
import { GlassIconButton } from "@/components/GlassIconButton";
import { JournalView } from "@/components/JournalView";
import { NotesJournalTabs } from "@/components/NotesJournalTabs";
import { NotesView } from "@/components/NotesView";
import { SwipeableDay } from "@/components/SwipeableDay";
import { TaskDrawer } from "@/components/TaskDrawer";
import { TaskDrawerSheet } from "@/components/TaskDrawerSheet";
import { TasksView } from "@/components/TasksView";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";
import { usePrefetchAdjacentTasks } from "@/hooks/useTasks";
import { useTodayPanes } from "@/hooks/useTodayPanes";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import {
  CALENDAR_PANE_MAX_WIDTH,
  DRAWER_PANE_MAX_WIDTH,
  TASKS_PANE_MAX_WIDTH,
} from "@/utils/breakpoints";
import { useTheme, withOpacity } from "@/utils/theme";

type TDayState = {
  date: Temporal.PlainDate;
  direction: -1 | 0 | 1;
};

export default function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [preferences] = usePreferences();
  const multiPane = useIsMultiPane();
  const [panes, { togglePane }] = useTodayPanes();
  // Only the small-screen branch opens this (the large-screen branch docks
  // the drawer inline instead), but it's declared unconditionally like the
  // view-state hooks below since hooks can't run inside a conditional branch.
  const taskDrawerRef = useRef<BottomSheetMethods>(null);
  const [day, setDay] = useState<TDayState>(() => ({
    date: Temporal.Now.plainDateISO(),
    direction: 0,
  }));
  // `view`/`notesEditing`/`journalEditing` only drive the small-screen
  // single-view layout below, but as hooks they still need to run
  // unconditionally on every render regardless of `multiPane` — their derived
  // values (`viewDisabled`/`activeView`) are computed further down, after the
  // large-screen branch's early return, since only the small-screen JSX reads
  // them.
  const [view, setView] = useState<TDayView>("tasks");
  // Suspends notes day-swipe while the editor is focused, so horizontal drags
  // position the caret / select text instead of changing days. Only relevant
  // to the small-screen single-view layout — large screens don't swipe.
  const [notesEditing, setNotesEditing] = useState(false);
  // Same for Journal: a focused response field owns horizontal drags.
  const [journalEditing, setJournalEditing] = useState(false);
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
    // Only one trailing pane should carry the row's `marginLeft: "auto"` —
    // if both Calendar and Drawer had it, flexbox would split the leftover
    // space across both auto margins (opening a gap between them) instead
    // of letting the last one absorb it and dock the pair flush together.
    const calendarIsLastTrailingPane = showCalendar && !panes.drawer;
    // The viewed day is right here (unlike NewTaskButton's tab-bar accessory,
    // which reads it back from a module store because it renders outside the
    // screen's React tree), so push straight to it.
    const openNewTask = () =>
      router.push({
        pathname: "/new-task",
        params: { scheduledFor: day.date.toString() },
      });

    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View
          style={[
            styles.multiPaneHeader,
            { borderBottomColor: withOpacity(theme.colors.text, 0.1) },
          ]}
        >
          {/* Matches the Tasks pane's width below so DayNav centers over it,
              the same way it centers over the single view on small screens. */}
          <View style={[styles.fixedPane, styles.taskHeaderSlot]}>
            <DayNav date={day.date} onChangeDate={changeDate} />
          </View>
          <View style={[styles.headerActions, { gap: theme.gap }]}>
            <DayPaneToggles
              enableCalendar={preferences.enableCalendar}
              enableJournal={preferences.enableJournal}
              enableNotes={preferences.enableNotes}
              onTogglePane={togglePane}
              panes={panes}
            />
            <GlassIconButton
              accessibilityLabel="Toggle task drawer pane"
              active={panes.drawer}
              ionicon="file-tray-full-outline"
              onPress={() => togglePane("drawer")}
              sfSymbol="tray.full"
            />
            <GlassIconButton
              accessibilityLabel="New Task"
              ionicon="add-outline"
              onPress={openNewTask}
              sfSymbol="plus"
            />
          </View>
        </View>
        <View style={[styles.paneRow, { gap: theme.gap }]}>
          <View style={styles.fixedPane}>
            <TasksView date={day.date} />
          </View>
          {(showNotes || showJournal) && (
            <View style={styles.notesJournalPane}>
              {/* No key here (unlike CalendarView below): NotesJournalTabs
                  keys its own NotesView/JournalView content on date
                  internally, so the editor re-seeds on a day change without
                  also resetting which tab is selected. */}
              <NotesJournalTabs
                date={day.date.toString()}
                showJournal={showJournal}
                showNotes={showNotes}
              />
            </View>
          )}
          {showCalendar && (
            <View
              style={[
                styles.calendarPane,
                {
                  borderColor: withOpacity(theme.colors.text, 0.1),
                  borderRadius: theme.borderRadius,
                  marginLeft: calendarIsLastTrailingPane ? "auto" : 0,
                },
              ]}
            >
              {/* Keyed on date for the same reason as NotesJournalTabs:
                  CalendarView seeds its "now" line position once per mount
                  (see CalendarView.tsx), relying on a remount per day. */}
              <CalendarView date={day.date} key={day.date.toString()} />
            </View>
          )}
          {panes.drawer && (
            <View
              style={[
                styles.drawerPane,
                {
                  borderColor: withOpacity(theme.colors.text, 0.1),
                  borderRadius: theme.borderRadius,
                },
              ]}
            >
              <ScrollView contentContainerStyle={styles.drawerScrollContent}>
                <TaskDrawer date={day.date} />
              </ScrollView>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

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

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <DayNav date={day.date} onChangeDate={changeDate} />
        <View style={[styles.switcher, { gap: theme.gap }]}>
          {/* Standalone button, not folded into DayViewSwitcher's menu — the
              task drawer isn't a day "view" like Notes/Journal/Calendar, it
              opens its own sheet over whichever view is active. */}
          <GlassIconButton
            accessibilityLabel="Open task drawer"
            ionicon="file-tray-full-outline"
            onPress={() => taskDrawerRef.current?.present()}
            sfSymbol="tray.full"
          />
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
      <TaskDrawerSheet ref={taskDrawerRef} date={day.date} />
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
    alignItems: "center",
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    position: "absolute",
    right: 20,
    top: 0,
  },
  // Large screens: the DayNav slot is capped to the Tasks pane's width (below)
  // and pane toggles/New Task sit at the far right — a line under the row
  // separates it from the panes, matching the legacy desktop app. DayNav
  // already carries its own 12pt vertical padding (DayNav.tsx), so top/bottom
  // here only need 4pt more to bring the total to 16pt — matching the sides
  // and `paneRow.paddingTop` — instead of stacking a full 16pt on top of it.
  multiPaneHeader: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  // DayNav centers within this slot's width (cross-axis alignment on the
  // default column direction), same as it's centered over the full width on
  // small screens.
  taskHeaderSlot: {
    alignItems: "center",
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
  },
  paneRow: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Tasks is capped at a mobile-typical width so it doesn't stretch to fill a
  // wide window.
  fixedPane: {
    flex: 1,
    maxWidth: TASKS_PANE_MAX_WIDTH,
    minWidth: 280,
  },
  // Notes and Journal share one tabbed pane that flexes to fill whatever
  // space remains. NotesJournalTabs draws its own border (only the active
  // tab plus the card body below it, manila-folder style), not this wrapper.
  notesJournalPane: {
    flex: 1,
  },
  // Calendar gets its own (narrower) cap — a day timeline reads fine
  // narrower than a task list — plus a bordered card to set it apart from the
  // other panes, matching the legacy desktop app. `marginLeft` is set inline
  // per-render (see `calendarIsLastTrailingPane` above) rather than fixed to
  // "auto" here: only whichever trailing pane (Calendar or Drawer) is
  // actually last should absorb the row's leftover space and pin to the
  // right edge — giving both an unconditional auto margin would split that
  // space across the two instead of docking them flush together. `padding`
  // matches TasksView's own list padding so both panes give their content
  // the same breathing room from their pane's edge.
  calendarPane: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    maxWidth: CALENDAR_PANE_MAX_WIDTH,
    minWidth: 200,
    overflow: "hidden",
    padding: 16,
  },
  // Docked at the row's far right, after Calendar (legacy QuickDrawer
  // parity). Always the last trailing pane when shown (nothing renders after
  // it), so its `marginLeft: "auto"` can stay fixed here rather than
  // computed like `calendarPane`'s. No `padding` here (unlike `calendarPane`)
  // — `TaskDrawer` pads its own content.
  drawerPane: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    marginLeft: "auto",
    maxWidth: DRAWER_PANE_MAX_WIDTH,
    minWidth: 280,
    overflow: "hidden",
  },
  drawerScrollContent: {
    flexGrow: 1,
  },
});
