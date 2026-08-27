import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CalendarView } from "@/components/CalendarView";
import { DayNavHeader } from "@/components/DayNavHeader";
import { DayViewSwitcher, TDayView } from "@/components/DayViewSwitcher";
import { NotesView } from "@/components/NotesView";
import { SwipeablePage } from "@/components/SwipeablePage";
import {
  TaskDrawerSheet,
  TTaskDrawerSheetHandle,
} from "@/components/TaskDrawerSheet";
import { TasksView } from "@/components/TasksView";
import { TPreferences } from "@/api/preferences";
import { TFilterId } from "@/utils/taskFilters";
import { TDayLink } from "@/utils/todayRoute";
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
  /** DEX-47 deep link, or null. `backlog` opens the drawer instead of a view. */
  link: TDayLink | null;
};

// Single-view (small-screen) Today layout — owns state only this layout
// needs; the multi-pane layout lives in LargeScreenToday.
export function SmallScreenToday({
  date,
  direction,
  preferences,
  changeDate,
  changeDateBy,
  attentionFilter,
  link,
}: TSmallScreenTodayProps) {
  const theme = useTheme();
  const backlogAttention = attentionFilter !== null;
  const mode = link?.mode ?? null;
  // Seeded from the route so a first-render deep link is already right — the
  // appliedLinkId adjustment below only fires on a change.
  const [view, setView] = useState<TDayView>(
    mode && mode !== "backlog" ? mode : "tasks",
  );
  // Suspends notes day-swipe while the editor is focused, so horizontal drags
  // position the caret / select text instead of changing days.
  const [notesEditing, setNotesEditing] = useState(false);
  const taskDrawerRef = useRef<TTaskDrawerSheetHandle>(null);

  // Adjusted during render, like viewDisabled below — no wrong-view frame, no
  // effect. Keyed on link.id so switching views afterward doesn't snap back.
  const linkId = link?.id ?? null;
  const [appliedLinkId, setAppliedLinkId] = useState(linkId);
  if (linkId !== appliedLinkId) {
    setAppliedLinkId(linkId);
    // `backlog` is not a day view — the sheet below handles it.
    if (mode && mode !== "backlog") setView(mode);
  }

  // Imperative sheet API, so an effect is the right tool. Pre-filtered to
  // Unscheduled and pre-searched so the tapped result is on screen immediately.
  const linkQuery = link?.query;
  useEffect(() => {
    if (mode === "backlog") {
      taskDrawerRef.current?.present("unscheduled", linkQuery ?? "");
    }
  }, [linkId, mode, linkQuery]);

  // Fall back to Tasks if the active view is disabled in settings (e.g. Notes
  // toggled off while viewing it). All views share `date`.
  const viewDisabled =
    (view === "notes" && !preferences.enableNotes) ||
    (view === "calendar" && !preferences.enableCalendar);
  // Adjusted during render (React's supported pattern) so re-enabling later
  // doesn't jump back into a view the user wasn't looking at — no flash, no effect.
  if (viewDisabled) setView("tasks");
  const activeView: TDayView = viewDisabled ? "tasks" : view;

  // Suspended while notes is focused — it owns horizontal drags for caret/
  // selection; Calendar and Tasks have no such conflict.
  const swipeEnabled = activeView === "notes" ? !notesEditing : undefined;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* column-reverse puts the scroll view first in the tree (DEX-136);
          TaskDrawerSheet stays outside since its layout contribution is a modal's. */}
      <View style={styles.reversed}>
        <DayViewContent
          view={activeView}
          date={date}
          direction={direction}
          swipeEnabled={swipeEnabled}
          onNotesEditingChange={setNotesEditing}
          onSwipe={changeDateBy}
        />
        <DayNavHeader
          date={date}
          onChangeDate={changeDate}
          trailing={
            /* Drawer trigger lives in this menu, not a second header button —
             a standalone one crowded DayNav's next-day arrow. */
            <DayViewSwitcher
              view={activeView}
              onChangeView={setView}
              onOpenDrawer={() =>
                // Resets both filter and search a mode=backlog link left
                // seeded (DEX-47); "none", not undefined, or the old filter survives.
                taskDrawerRef.current?.present(attentionFilter ?? "none", "")
              }
              attention={backlogAttention}
              enableNotes={preferences.enableNotes}
              enableCalendar={preferences.enableCalendar}
            />
          }
        />
      </View>
      <TaskDrawerSheet ref={taskDrawerRef} date={date} />
    </SafeAreaView>
  );
}

type TDayViewContentProps = {
  view: TDayView;
  date: Temporal.PlainDate;
  direction: -1 | 0 | 1;
  swipeEnabled: boolean | undefined;
  onNotesEditingChange: (editing: boolean) => void;
  onSwipe: (days: 1 | -1) => void;
};

// Remounts content per date; days are unbounded, so no canPrev/canNext —
// every swipe commits.
function DayViewContent({
  view,
  date,
  direction,
  swipeEnabled,
  onNotesEditingChange,
  onSwipe,
}: TDayViewContentProps) {
  return (
    <SwipeablePage
      pageKey={date.toString()}
      direction={direction}
      enabled={swipeEnabled}
      onSwipe={onSwipe}
    >
      {view === "notes" ? (
        <NotesView
          date={date.toString()}
          onEditingChange={onNotesEditingChange}
        />
      ) : view === "calendar" ? (
        <CalendarView date={date} />
      ) : (
        <TasksView date={date} />
      )}
    </SwipeablePage>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  reversed: {
    flex: 1,
    flexDirection: "column-reverse",
  },
});
