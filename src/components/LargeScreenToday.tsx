import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CalendarView } from "@/components/CalendarView";
import { DayNav } from "@/components/DayNav";
import { DayPaneToggles } from "@/components/DayPaneToggles";
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
  // The Filter preset to pre-apply via the header toggle, or null when
  // nothing needs attention; also drives the drawer toggle's dot.
  attentionFilter: TFilterId | null;
  // DEX-47 deep link, or null. `mode: "tasks"` is a no-op (Tasks is always
  // visible); `notes` opens that pane; `backlog` seeds the drawer with `query`.
  link: TDayLink | null;
};

// The multi-pane Today layout: Tasks plus optional Notes, Calendar, and a
// docked drawer. Small-screen equivalent is SmallScreenToday.
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
  // Controlled so the header toggle can pre-apply the attention filter;
  // seeded from the route so a first render with the link set isn't unfiltered.
  const isBacklogLink = mode === "backlog";
  const [drawerFilterId, setDrawerFilterId] = useState<TFilterId>(
    isBacklogLink ? "unscheduled" : "none",
  );
  const [drawerSearch, setDrawerSearch] = useState(
    isBacklogLink ? (link?.query ?? "") : "",
  );

  // DEX-47: adjusted during render, not an effect, so the drawer never paints
  // unfiltered for a frame; keyed on link.id so re-following re-seeds.
  const [appliedLinkId, setAppliedLinkId] = useState(linkId);
  if (linkId !== appliedLinkId) {
    setAppliedLinkId(linkId);
    if (mode === "backlog") {
      setDrawerFilterId("unscheduled");
      setDrawerSearch(link?.query ?? "");
    }
  }

  // openPane (not togglePane) does its own already-open check, keeping panes
  // out of the deps — otherwise every later toggle would re-open a closed pane.
  useEffect(() => {
    if (!mode || mode === "tasks") return;
    void openPane(mode === "backlog" ? "drawer" : mode);
  }, [linkId, mode, openPane]);

  const showNotes = preferences.enableNotes && panes.notes;
  const showCalendar = preferences.enableCalendar && panes.calendar;

  // When opening (not closing) with stragglers, pre-apply the dot's filter
  // so this lands on the same view as the small-screen "tap Backlog" flow.
  const toggleDrawerPane = () => {
    if (!panes.drawer) {
      // Resets any mode=backlog seeding (DEX-47) — this entry point means
      // "show my backlog," not a link's stale Unscheduled filter.
      setDrawerFilterId(attentionFilter ?? "none");
      setDrawerSearch("");
    }
    void togglePane("drawer");
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <LargeScreenHeader
        actions={
          <>
            <DayPaneToggles
              enableCalendar={preferences.enableCalendar}
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
          </>
        }
      >
        <View style={[styles.fixedPane, styles.taskHeaderSlot]}>
          <DayNav date={date} onChangeDate={changeDate} />
        </View>
      </LargeScreenHeader>
      {/* Drag-to-schedule between Tasks and the backlog drawer (DEX-77) —
          large screens only, where the panes are siblings. */}
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
              {/* Keyed on date so NotesView remounts and re-seeds for a new
                  day; card={false} since this pane already draws the border. */}
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
              {/* Keyed on date, same reason as Notes: CalendarView seeds its
                  "now" line once per mount. */}
              <CalendarView date={date} key={date.toString()} />
            </View>
          )}
          {panes.drawer && (
            // scheduledFor={null}: dropping a card here clears its date,
            // the inverse of dragging one out (DEX-77).
            <TaskDropTarget
              scheduledFor={null}
              testID="backlog-drop-target"
              style={[
                styles.drawerPane,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                  // Drop this pane's own margin when Calendar's absorbs the
                  // leftover space, or the pair splits into two gaps.
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
  // DayNav centers in this slot, capped to the Tasks pane's width so it sits
  // over that pane (LargeScreenHeader, shared with Week).
  taskHeaderSlot: {
    alignItems: "center",
  },
  // gap matches Week's column gap (DEX-115) — panes run flush, so no gap
  // stacks on this (docs/design.md, "Who owns spacing").
  paneRow: {
    flex: 1,
    flexDirection: "row",
  },
  // Fixed, not flexing (DEX-111) — a task card is the same shape on every
  // screen; panes beside it absorb the difference. Shared with taskHeaderSlot.
  fixedPane: {
    width: TASKS_PANE_WIDTH,
  },
  // No padding — the note editor supplies its own, unlike Calendar's timeline.
  notesPane: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: "hidden",
  },
  // marginLeft: "auto" pins it right even with Notes hidden; always renders
  // before Drawer, so this margin absorbs the leftover space unconditionally.
  calendarPane: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    marginLeft: "auto",
    maxWidth: CALENDAR_PANE_MAX_WIDTH,
    minWidth: 200,
    overflow: "hidden",
  },
  // marginLeft set inline per-render — 0 when Calendar's own auto margin
  // already pushes the pair right, "auto" otherwise.
  drawerPane: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    maxWidth: DRAWER_PANE_MAX_WIDTH,
    minWidth: TASK_LIST_PANE_MIN_WIDTH,
    overflow: "hidden",
  },
});
