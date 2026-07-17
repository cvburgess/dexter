import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
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
import {
  TaskDrawerSheet,
  TTaskDrawerSheetHandle,
} from "@/components/TaskDrawerSheet";
import { TasksView } from "@/components/TasksView";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";
import { useTodayPanes } from "@/hooks/useTodayPanes";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import {
  CALENDAR_PANE_MAX_WIDTH,
  DRAWER_PANE_MAX_WIDTH,
  TASKS_PANE_MAX_WIDTH,
} from "@/utils/breakpoints";
import { backlogAttentionFilter, TFilterId } from "@/utils/taskFilters";
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
  // Only the small-screen branch opens this (the large-screen branch docks the
  // drawer inline instead), but it's declared unconditionally since hooks
  // can't run inside a conditional branch.
  const taskDrawerRef = useRef<TTaskDrawerSheetHandle>(null);
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
  // So "New Task" opened from this tab defaults its schedule to the viewed day.
  usePublishViewedDay(day.date);

  // Drives the Backlog attention dot and the filter that tapping Backlog
  // pre-applies (DEX-58): the Filter preset for the first overdue/left-behind
  // task (Overdue wins), or null when there's nothing. Anchored to the real
  // today, not `day.date` — it signals stragglers regardless of which day is on
  // screen. Reads the shared, already-warm `["tasks"]` cache the panes use, so
  // it costs no extra fetch.
  const [allTasks] = useTasks();
  const attentionFilter = useMemo(
    () => backlogAttentionFilter(allTasks, Temporal.Now.plainDateISO()),
    [allTasks],
  );
  const backlogAttention = attentionFilter !== null;
  // The large-screen docked drawer runs controlled off this so opening it via
  // the header toggle can pre-apply the attention filter (see `openDrawerPane`),
  // mirroring the small-screen "tap Backlog" flow. The small-screen sheet owns
  // its own filter internally instead (`TaskDrawerSheet`).
  const [drawerFilterId, setDrawerFilterId] = useState<TFilterId>("none");

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
    // The viewed day is right here (unlike NewTaskButton's tab-bar accessory,
    // which reads it back from a module store because it renders outside the
    // screen's React tree), so push straight to it.
    const openNewTask = () =>
      router.push({
        pathname: "/new-task",
        params: { scheduledFor: day.date.toString() },
      });

    // Toggling the drawer pane; when it's opening (not closing) and there are
    // stragglers, pre-apply the filter the dot points to so it lands on the
    // same view as the small-screen "tap Backlog" flow.
    const toggleDrawerPane = () => {
      if (!panes.drawer && attentionFilter) setDrawerFilterId(attentionFilter);
      // `togglePane` persists to AsyncStorage; fire-and-forget like the other
      // pane toggles (which pass it straight to `onPress`).
      void togglePane("drawer");
    };

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
              indicator={backlogAttention}
              ionicon="file-tray-full-outline"
              onPress={toggleDrawerPane}
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
                  // Calendar (rendered above, when shown) already carries the
                  // unconditional auto margin and always renders before this
                  // pane, so its leading margin absorbs the row's leftover
                  // space and pushes the whole {Calendar, Drawer} group right
                  // together — this pane's own margin must drop out then, or
                  // the leftover space would split across both auto margins
                  // and open a gap between them instead of docking flush.
                  marginLeft: showCalendar ? 0 : "auto",
                },
              ]}
            >
              <TaskDrawer
                date={day.date}
                filterId={drawerFilterId}
                onFilterChange={setDrawerFilterId}
              />
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
  // other panes, matching the legacy desktop app. `marginLeft: "auto"` pins
  // it to the row's right edge even when Notes/Journal isn't rendered to
  // push it there itself. Calendar always renders before Drawer, so this
  // margin is unconditional — it's the one that needs to absorb the row's
  // leftover space; `drawerPane` below drops its own when Calendar is
  // present so the two dock flush together instead of splitting the space
  // across both auto margins. `padding` matches TasksView's own list padding
  // so both panes give their content the same breathing room from their
  // pane's edge.
  calendarPane: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    marginLeft: "auto",
    maxWidth: CALENDAR_PANE_MAX_WIDTH,
    minWidth: 200,
    overflow: "hidden",
    padding: 16,
  },
  // Docked at the row's far right, after Calendar (legacy QuickDrawer
  // parity). `marginLeft` is set inline per-render (0 when Calendar is also
  // shown, since Calendar's own auto margin already pushes the pair right
  // together; "auto" when Calendar is hidden, so this pane pins itself).
  // No `padding` here (unlike `calendarPane`) — `TaskDrawer` pads its own
  // content.
  drawerPane: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    maxWidth: DRAWER_PANE_MAX_WIDTH,
    minWidth: 280,
    overflow: "hidden",
  },
});
