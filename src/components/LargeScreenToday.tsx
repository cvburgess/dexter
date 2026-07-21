import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { DraxProvider } from "react-native-drax";
import { SafeAreaView } from "react-native-safe-area-context";

import { CalendarView } from "@/components/CalendarView";
import { DayNav } from "@/components/DayNav";
import { DayPaneToggles } from "@/components/DayPaneToggles";
import { GlassIconButton } from "@/components/GlassIconButton";
import { NotesJournalTabs } from "@/components/NotesJournalTabs";
import { TaskDrawer } from "@/components/TaskDrawer";
import { TasksDropTarget } from "@/components/TasksDropTarget";
import { TasksView } from "@/components/TasksView";
import { useTodayPanes } from "@/hooks/useTodayPanes";
import { TPreferences } from "@/api/preferences";
import {
  CALENDAR_PANE_MAX_WIDTH,
  DRAWER_PANE_MAX_WIDTH,
  TASKS_PANE_MAX_WIDTH,
} from "@/utils/breakpoints";
import { TFilterId } from "@/utils/taskFilters";
import { useTheme, withOpacity } from "@/utils/theme";

type TLargeScreenTodayProps = {
  date: Temporal.PlainDate;
  preferences: TPreferences;
  changeDate: (next: Temporal.PlainDate) => void;
  // The Filter preset to pre-apply when opening the docked drawer via the
  // header toggle (Overdue/left-behind), or null when nothing needs attention.
  // Drives the drawer toggle's dot.
  attentionFilter: TFilterId | null;
};

// The multi-pane (large-screen) Today layout: Tasks plus optional Notes/Journal,
// Calendar, and a docked task drawer side by side. Owns the state that only this
// layout needs (`panes`/the docked drawer filter); the single-view small-screen
// layout lives in `SmallScreenToday`.
export function LargeScreenToday({
  date,
  preferences,
  changeDate,
  attentionFilter,
}: TLargeScreenTodayProps) {
  const theme = useTheme();
  const router = useRouter();
  const [panes, { togglePane }] = useTodayPanes();
  const backlogAttention = attentionFilter !== null;
  // The docked drawer runs controlled off this so opening it via the header
  // toggle can pre-apply the attention filter (see `toggleDrawerPane`),
  // mirroring the small-screen "tap Backlog" flow. The small-screen sheet owns
  // its own filter internally instead (`TaskDrawerSheet`).
  const [drawerFilterId, setDrawerFilterId] = useState<TFilterId>("none");

  const showNotes = preferences.enableNotes && panes.notes;
  const showJournal = preferences.enableJournal && panes.journal;
  const showCalendar = preferences.enableCalendar && panes.calendar;

  // The viewed day is right here (unlike NewTaskButton's tab-bar accessory,
  // which reads it back from a module store because it renders outside the
  // screen's React tree), so push straight to it.
  const openNewTask = () =>
    router.push({
      pathname: "/new-task",
      params: { scheduledFor: date.toString() },
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
          <DayNav date={date} onChangeDate={changeDate} />
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
      {/* Scopes drag-to-schedule to the pane row, which holds both the drag
          sources (the drawer's rows) and the drop target (the Tasks pane).
          Wrapping the row rather than styling the provider as the row itself
          keeps the provider's hover layer out of the row's flex layout. */}
      <DraxProvider style={styles.dragArea}>
        <View style={[styles.paneRow, { gap: theme.gap }]}>
          <TasksDropTarget date={date} style={styles.fixedPane}>
            <TasksView date={date} />
          </TasksDropTarget>
          {(showNotes || showJournal) && (
            <View style={styles.notesJournalPane}>
              {/* No key here (unlike CalendarView below): NotesJournalTabs
                  keys its own NotesView/JournalView content on date
                  internally, so the editor re-seeds on a day change without
                  also resetting which tab is selected. */}
              <NotesJournalTabs
                date={date.toString()}
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
              <CalendarView date={date} key={date.toString()} />
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
                date={date}
                enableDrag
                filterId={drawerFilterId}
                onFilterChange={setDrawerFilterId}
              />
            </View>
          )}
        </View>
      </DraxProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  // The DraxProvider's own view; it only needs to fill the space below the
  // header so the pane row inside it lays out exactly as it did before.
  dragArea: {
    flex: 1,
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
