import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CalendarView } from "@/components/CalendarView";
import { DayNav } from "@/components/DayNav";
import { DragScheduleProvider } from "@/components/DragScheduleProvider";
import { GlassIconButton } from "@/components/GlassIconButton";
import { LargeScreenHeader } from "@/components/LargeScreenHeader";
import { NotesView } from "@/components/NotesView";
import { TaskDrawer } from "@/components/TaskDrawer";
import { TaskDropTarget } from "@/components/TaskDropTarget";
import { TasksView } from "@/components/TasksView";
import { useTodayPanes } from "@/hooks/useTodayPanes";
import { TPreferences } from "@/api/preferences";
import {
  CALENDAR_PANE_MAX_WIDTH,
  DRAWER_PANE_MAX_WIDTH,
  TASK_LIST_PANE_MIN_WIDTH,
  TASKS_PANE_WIDTH,
} from "@/utils/breakpoints";
import { TFilterId } from "@/utils/taskFilters";
import { TDayLink } from "@/utils/todayRoute";
import { useTheme } from "@/utils/theme";

type TLargeScreenTodayProps = {
  date: Temporal.PlainDate;
  preferences: TPreferences;
  changeDate: (next: Temporal.PlainDate) => void;
  // The Filter preset to pre-apply when opening the docked drawer via the
  // header toggle (Overdue/left-behind), or null when nothing needs attention.
  // Drives the drawer toggle's dot.
  attentionFilter: TFilterId | null;
  /**
   * The deep link this screen was opened with (DEX-47), or null for an ordinary
   * tab press. Only `backlog` has anything left to do here — it opens the docked
   * drawer seeded with `query`. Tasks is always visible, and so is Notes when
   * it's enabled in settings, so those two modes arrive already showing what
   * they name. Keyed on `id` so re-following the same link works.
   */
  link: TDayLink | null;
};

// The multi-pane (large-screen) Today layout: Tasks plus optional Notes,
// Calendar, and a docked task drawer side by side. Owns the state that only this
// layout needs (`panes`/the docked drawer filter); the single-view small-screen
// layout lives in `SmallScreenToday`.
export function LargeScreenToday({
  date,
  preferences,
  changeDate,
  attentionFilter,
  link,
}: TLargeScreenTodayProps) {
  const theme = useTheme();
  const [panes, { togglePane, openPane }] = useTodayPanes();
  const backlogAttention = attentionFilter !== null;
  const mode = link?.mode ?? null;
  const linkId = link?.id ?? null;
  // The docked drawer runs controlled off these so opening it via the header
  // toggle can pre-apply the attention filter (see `toggleDrawerPane`),
  // mirroring the small-screen "tap Backlog" flow. The small-screen sheet owns
  // its own state internally instead (`TaskDrawerSheet`).
  //
  // Both seeded from the route so a `?mode=backlog` deep link is already applied
  // on the first render — the `appliedLinkId` adjustment below only fires on a
  // *change*, so arriving with the link set would otherwise show an unfiltered
  // drawer.
  const isBacklogLink = mode === "backlog";
  const [drawerFilterId, setDrawerFilterId] = useState<TFilterId>(
    isBacklogLink ? "unscheduled" : "none",
  );
  const [drawerSearch, setDrawerSearch] = useState(
    isBacklogLink ? (link?.query ?? "") : "",
  );

  // Seed the drawer for a `?mode=backlog` deep link (DEX-47). Adjusted during
  // render rather than in an effect so the drawer never paints unfiltered for a
  // frame first. Keyed on `link.id`, which changes per navigation, so the user
  // can adjust the filter or search afterwards without this resetting them *and*
  // re-following the same link still re-seeds it.
  const [appliedLinkId, setAppliedLinkId] = useState(linkId);
  if (linkId !== appliedLinkId) {
    setAppliedLinkId(linkId);
    if (mode === "backlog") {
      // Unscheduled is where a task with no date lives; the query puts the one
      // the user tapped at the top of the drawer rather than in the backlog.
      setDrawerFilterId("unscheduled");
      setDrawerSearch(link?.query ?? "");
    }
  }

  // Opening the drawer writes through to AsyncStorage — an external system, so
  // an effect is the right home. `openPane` (not `togglePane`) is stable and
  // does its own already-open check, which keeps `panes` out of the
  // dependencies: with it here, every later drawer toggle would re-run this and
  // re-open a pane the user had just closed.
  //
  // Only `backlog` has anything to open. `mode: "tasks"` was always a no-op
  // here, and `notes` became one when the pane toggles went (DEX-152): Notes
  // and Calendar now show whenever they're enabled in settings, so a link
  // naming one has already arrived at it.
  //
  // `linkId` is in the dependencies alongside `mode` because re-following the
  // same link has to re-open a drawer the user closed in between; `mode` is
  // encoded in `linkId`, so listing both costs no extra firings.
  useEffect(() => {
    if (mode !== "backlog") return;
    void openPane("drawer");
  }, [linkId, mode, openPane]);

  // Settings is the only control over these now (DEX-152) — the header's pane
  // toggles are gone. Named rather than read inline because `showCalendar` is a
  // layout question the drawer's margin below also asks, not just a setting.
  const showNotes = preferences.enableNotes;
  const showCalendar = preferences.enableCalendar;

  // Toggling the drawer pane; when it's opening (not closing) and there are
  // stragglers, pre-apply the filter the dot points to so it lands on the
  // same view as the small-screen "tap Backlog" flow.
  const toggleDrawerPane = () => {
    if (!panes.drawer) {
      // Resets *both* the filter and the search a `mode=backlog` deep link left
      // seeded: this entry point means "show me my backlog", not "show it still
      // narrowed to Unscheduled by a link I followed three screens ago"
      // (DEX-47). Falling back to `"none"` rather than leaving the previous
      // filter is what stops that seeded Unscheduled from surviving; little is
      // lost, since an attention filter already overrode whatever the user had
      // selected, so the filter never reliably persisted between opens.
      setDrawerFilterId(attentionFilter ?? "none");
      setDrawerSearch("");
    }
    // `togglePane` persists to AsyncStorage; fire-and-forget like the other
    // pane toggles (which pass it straight to `onPress`).
    void togglePane("drawer");
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <LargeScreenHeader
        actions={
          <GlassIconButton
            accessibilityLabel="Toggle task drawer pane"
            active={panes.drawer}
            indicator={backlogAttention}
            ionicon="file-tray-full-outline"
            onPress={toggleDrawerPane}
            sfSymbol="tray.full"
          />
        }
      >
        <DayNav date={date} onChangeDate={changeDate} />
      </LargeScreenHeader>
      {/* Backlog rows can be dragged onto the Tasks pane to schedule them for
          the viewed day, and a scheduled card dragged back onto the backlog to
          unschedule it (DEX-77). Large screens only — this is the layout where
          the two panes are siblings, so a card can actually travel between
          them. */}
      <DragScheduleProvider>
        <View
          style={[
            styles.paneRow,
            {
              gap: theme.space.md,
              paddingHorizontal: theme.space.md,
              paddingTop: theme.space.md,
            },
          ]}
        >
          <TaskDropTarget
            scheduledFor={date.toString()}
            style={styles.fixedPane}
            testID="tasks-drop-target"
          >
            <TasksView date={date} />
          </TaskDropTarget>
          {showNotes && (
            <View
              style={[
                styles.notesPane,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
            >
              {/* Keyed on date: NotesView seeds its editor uncontrolled and
                  relies on a remount to re-seed for a new day (see its own
                  comments). `card={false}` because this pane draws the border;
                  a second one inside it would double up. */}
              <NotesView
                card={false}
                date={date.toString()}
                key={date.toString()}
              />
            </View>
          )}
          {showCalendar && (
            <View
              style={[
                styles.calendarPane,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                  // Matches TasksView's own list padding, so both panes give
                  // their content the same breathing room from the pane's edge.
                  padding: theme.space.md,
                },
              ]}
            >
              {/* Keyed on date for the same reason as the Notes pane above:
                  CalendarView seeds its "now" line position once per mount
                  (see CalendarView.tsx), relying on a remount per day. */}
              <CalendarView date={date} key={date.toString()} />
            </View>
          )}
          {panes.drawer && (
            // `scheduledFor={null}`: dropping a scheduled card here clears its
            // date and returns it to the backlog, the inverse of dragging one
            // out (DEX-77).
            <TaskDropTarget
              scheduledFor={null}
              testID="backlog-drop-target"
              style={[
                styles.drawerPane,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
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
                filterId={drawerFilterId}
                onFilterChange={setDrawerFilterId}
                search={drawerSearch}
                onSearchChange={setDrawerSearch}
              />
            </TaskDropTarget>
          )}
        </View>
      </DragScheduleProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // `space.md` for the gutter, not a literal: `LargeScreenHeader` above uses
  // the same token, so the panes start where the header's own contents do.
  //
  // The `gap` reads that same token, matching the Week tab's column gap
  // (DEX-115) — so the space between two panes equals the space outside the
  // first and last, and the two tabs space their content identically. The panes
  // themselves run flush; nothing stacks on top of this gap (see
  // docs/design.md, "Who owns spacing").
  paneRow: {
    flex: 1,
    flexDirection: "row",
  },
  // Tasks holds one fixed width rather than flexing (DEX-111): a task card is
  // the same object on every screen, and stretching with the window made it a
  // different shape on each. The panes beside it absorb the difference.
  fixedPane: {
    width: TASKS_PANE_WIDTH,
  },
  // Notes flexes to fill whatever space remains, in a bordered card matching
  // Calendar's. It carried no border of its own until DEX-105, when the tabbed
  // Notes/Journal pane it used to share (which drew one, manila-folder style)
  // was retired along with the journal's place on this tab. No padding: the
  // note editor supplies its own, unlike Calendar's timeline.
  notesPane: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: "hidden",
  },
  // Calendar gets its own (narrower) cap — a day timeline reads fine
  // narrower than a task list — plus a bordered card to set it apart from the
  // other panes, matching the legacy desktop app. `marginLeft: "auto"` pins
  // it to the row's right edge even when Notes isn't rendered to push it
  // there itself. Calendar always renders before Drawer, so this
  // margin is unconditional — it's the one that needs to absorb the row's
  // leftover space; `drawerPane` below drops its own when Calendar is
  // present so the two dock flush together instead of splitting the space
  // across both auto margins.
  calendarPane: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    marginLeft: "auto",
    maxWidth: CALENDAR_PANE_MAX_WIDTH,
    minWidth: 200,
    overflow: "hidden",
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
    minWidth: TASK_LIST_PANE_MIN_WIDTH,
    overflow: "hidden",
  },
});
