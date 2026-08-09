import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CalendarView } from "@/components/CalendarView";
import { DayNavHeader } from "@/components/DayNavHeader";
import { DayViewSwitcher, TDayView } from "@/components/DayViewSwitcher";
import { JournalView } from "@/components/JournalView";
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
  /**
   * The deep link this screen was opened with (DEX-47), or null for an ordinary
   * tab press. `mode` selects the view — except `backlog`, which opens the
   * drawer sheet instead of changing the view at all — and `query` seeds the
   * drawer's search box. Keyed on `id` so re-following the same link works.
   */
  link: TDayLink | null;
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
  link,
}: TSmallScreenTodayProps) {
  const theme = useTheme();
  const backlogAttention = attentionFilter !== null;
  const mode = link?.mode ?? null;
  // Seeded from the route so a deep link is already right on the first render —
  // the `appliedLinkId` adjustment below only fires on a *change*, so arriving
  // with `?mode=` set would otherwise land on Tasks. `backlog` isn't a view
  // (the sheet handles it), so it seeds Tasks like an ordinary tab press.
  const [view, setView] = useState<TDayView>(
    mode && mode !== "backlog" ? mode : "tasks",
  );
  // Suspends notes day-swipe while the editor is focused, so horizontal drags
  // position the caret / select text instead of changing days.
  const [notesEditing, setNotesEditing] = useState(false);
  // Same for Journal: a focused response field owns horizontal drags.
  const [journalEditing, setJournalEditing] = useState(false);
  const taskDrawerRef = useRef<TTaskDrawerSheetHandle>(null);

  // Select the view a `?mode=` deep link asked for (DEX-47). Adjusted during
  // render, the same way the `viewDisabled` reset below is and for the same
  // reason — no wrong-view frame, no effect. Keyed on `link.id`, which changes
  // per navigation, so the user can switch views afterwards without this
  // snapping them back *and* re-following the same link still works.
  const linkId = link?.id ?? null;
  const [appliedLinkId, setAppliedLinkId] = useState(linkId);
  if (linkId !== appliedLinkId) {
    setAppliedLinkId(linkId);
    // `backlog` is not a day view — the sheet below handles it.
    if (mode && mode !== "backlog") setView(mode);
  }

  // The sheet is an imperative native API rather than React state, so poking it
  // is exactly what an effect is for. Pre-filtered to Unscheduled (where a task
  // with no date lives) and pre-searched, so the result the user tapped is on
  // screen straight away instead of somewhere in the backlog. Keyed on `linkId`
  // for the same reason as above — tapping the same result again after
  // dismissing the sheet has to re-present it.
  // Depends on primitives rather than `link`, which is a fresh object every
  // render. `mode` and `linkQuery` are both encoded in `linkId`, so listing them
  // costs no extra firings and keeps the dependency list honest.
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
    (view === "journal" && !preferences.enableJournal) ||
    (view === "calendar" && !preferences.enableCalendar);
  // Reset the stored `view` when its feature is disabled, so re-enabling later
  // doesn't jump back into a view the user hasn't been looking at. Adjusting
  // state during render (React's supported pattern) corrects it before paint —
  // no flash and no effect. `activeView` guards the pre-reset render pass.
  if (viewDisabled) setView("tasks");
  const activeView: TDayView = viewDisabled ? "tasks" : view;

  // Suspended while a note/journal response field is focused — a focused
  // editor owns horizontal drags for caret/selection until the user taps
  // Done. Calendar and Tasks have no such conflict (Calendar's timeline
  // scrolls vertically) and always allow swiping.
  const swipeEnabled =
    activeView === "notes"
      ? !notesEditing
      : activeView === "journal"
        ? !journalEditing
        : undefined;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <DayNavHeader
        date={date}
        onChangeDate={changeDate}
        trailing={
          /* The task-drawer trigger lives inside this menu (via onOpenDrawer)
             rather than as a second header button — a standalone button here
             crowded DayNav's next-day arrow. */
          <DayViewSwitcher
            view={activeView}
            onChangeView={setView}
            onOpenDrawer={() =>
              // Resets *both* the filter and the search a `mode=backlog` deep
              // link left seeded: this entry point means "show me my backlog",
              // not "show it still narrowed to Unscheduled by a link I followed
              // three screens ago" (DEX-47).
              //
              // `"none"` rather than `undefined` when nothing needs attention —
              // `undefined` leaves the previous filter in place, which is how
              // the seeded Unscheduled used to survive. Little is lost: opening
              // with an attention filter already overrode whatever the user had
              // selected, so the filter never reliably persisted between opens.
              taskDrawerRef.current?.present(attentionFilter ?? "none", "")
            }
            attention={backlogAttention}
            enableNotes={preferences.enableNotes}
            enableJournal={preferences.enableJournal}
            enableCalendar={preferences.enableCalendar}
          />
        }
      />
      <DayViewContent
        view={activeView}
        date={date}
        direction={direction}
        swipeEnabled={swipeEnabled}
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
  swipeEnabled: boolean | undefined;
  onNotesEditingChange: (editing: boolean) => void;
  onJournalEditingChange: (editing: boolean) => void;
  onSwipe: (days: 1 | -1) => void;
};

// SwipeablePage remounts its content per date, re-seeding editors/inputs and
// re-fetching calendar events. Days are unbounded, so it takes neither
// `canPrev` nor `canNext` — every swipe commits.
function DayViewContent({
  view,
  date,
  direction,
  swipeEnabled,
  onNotesEditingChange,
  onJournalEditingChange,
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
    </SwipeablePage>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
