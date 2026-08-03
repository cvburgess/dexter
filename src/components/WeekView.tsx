import { Temporal } from "@js-temporal/polyfill";
import { useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from "react-native";
import { DraxScrollView } from "react-native-drax";
import { SafeAreaView } from "react-native-safe-area-context";

import { DragScheduleProvider } from "@/components/DragScheduleProvider";
import { GlassIconButton } from "@/components/GlassIconButton";
import { LargeScreenHeader } from "@/components/LargeScreenHeader";
import { TaskDrawer } from "@/components/TaskDrawer";
import { TaskDropTarget } from "@/components/TaskDropTarget";
import { WeekDayColumn } from "@/components/WeekDayColumn";
import { WeekNav } from "@/components/WeekNav";
import {
  DRAWER_PANE_MAX_WIDTH,
  TASK_LIST_PANE_MIN_WIDTH,
  WEEK_COLUMN_MIN_WIDTH,
} from "@/utils/breakpoints";
import { scrollOffsetForTarget } from "@/utils/calendarLayout";
import { useTheme } from "@/utils/theme";
import { weekDays } from "@/utils/weekStartEnd";

type TWeekViewProps = {
  /** The Monday of the week on screen. */
  monday: Temporal.PlainDate;
  onChangeWeek: (monday: Temporal.PlainDate) => void;
  /**
   * The day the backlog's per-row "+" schedules onto — today when it falls
   * inside this week, otherwise the week's Monday. The route picks it and also
   * publishes it as the viewed day, so the nav rail's "+" agrees; see
   * `week/index.tsx`.
   */
  targetDate: Temporal.PlainDate;
  enableHabits: boolean;
  /**
   * The real calendar day, passed down rather than read from the clock here so
   * this and `targetDate` are always derived from the same instant — reading it
   * separately let an app left open across midnight move the today chip while
   * still scheduling onto yesterday. `Temporal.Now.plainDateISO()` re-resolves
   * the system time zone on every call, so sharing one read is also the
   * cheaper arrangement.
   */
  today: Temporal.PlainDate;
};

/**
 * The Week tab's large-screen layout (DEX-96): week navigation over seven day
 * columns, with an optional docked backlog — the legacy dexter-app's Week view,
 * including its drag-to-reschedule (DEX-77).
 *
 * The header row is `LargeScreenHeader`, shared with `LargeScreenToday`, so
 * switching tabs doesn't shift the nav row.
 */
export function WeekView({
  monday,
  onChangeWeek,
  targetDate,
  enableHabits,
  today,
}: TWeekViewProps) {
  const theme = useTheme();
  // Local rather than `useTodayPanes`: sharing the `drawer` pane would mean
  // opening the backlog here also opened it on Today, and the legacy view
  // didn't persist its Quick Planner toggle either.
  const [showDrawer, setShowDrawer] = useState(false);

  // Memoized because `date` identity propagates: `DayTaskList` memoizes its
  // per-day filter on it, and `HabitTracker`'s row-bootstrapping effect lists
  // it as a dependency — a fresh array each render would re-filter seven task
  // lists and re-fire that write effect on every unrelated re-render.
  const days = useMemo(() => weekDays(monday), [monday]);
  const todayIndex = days.findIndex((day) => day.equals(today));

  const scrollRef = useRef<ScrollView>(null);
  // Guards the anchor so it runs once: `onLayout` fires again on any re-layout
  // (opening the backlog pane, a device rotation), and re-scrolling then would
  // yank the user back to today after they had scrolled elsewhere. Keyed on the
  // week rather than a bare boolean only so the guard reads as "this week is
  // anchored" — paging weeks doesn't change the scroller's own layout, so it
  // doesn't re-fire `onLayout` and the horizontal offset is deliberately left
  // where the user put it. Same shape as `CalendarView`'s `didScrollToNowRef`.
  const anchoredWeek = useRef<string | null>(null);

  // Derived from the layout contract rather than measured, so this needs only
  // the scroller's own `onLayout` — no coordination with a child's layout or
  // with `onContentSizeChange`, either of which could land first and strand
  // the anchor. Whenever the week overflows (the only case where scrolling
  // exists) every column sits at exactly its minimum, since that is what
  // stopped them shrinking; when it doesn't overflow, this underestimates the
  // content and `scrollOffsetForTarget` clamps to 0 — which is the right
  // answer there anyway.
  // The *entire* space between two columns: the columns themselves run flush
  // (see `WeekDayColumn`), so nothing stacks on top of this the way two 16pt
  // gutters used to. Matches the row's own `paddingHorizontal`, so the space
  // between columns equals the space outside the first and last — the grid
  // reads as evenly spaced rather than edge-heavy. Load-bearing beyond
  // spacing: the anchor math below derives the column pitch from it, so the
  // two must move together or today scrolls to the wrong offset. Both read
  // `space.md`, so that agreement is structural rather than two literals that
  // happen to match.
  const columnGap = theme.space.md;
  const columnPitch = WEEK_COLUMN_MIN_WIDTH + columnGap;
  const minContentWidth = 7 * WEEK_COLUMN_MIN_WIDTH + 6 * columnGap;

  const anchorToday = (viewportWidth: number) => {
    const key = monday.toString();
    if (todayIndex < 0 || anchoredWeek.current === key) return;
    anchoredWeek.current = key;
    scrollRef.current?.scrollTo({
      // Anchors today in the left third rather than dead center, so the rest
      // of the week — the part you can still plan — stays in frame.
      x: scrollOffsetForTarget(
        todayIndex * columnPitch,
        viewportWidth,
        minContentWidth,
      ),
      animated: false,
    });
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
            active={showDrawer}
            ionicon="file-tray-full-outline"
            onPress={() => setShowDrawer((open) => !open)}
            sfSymbol="tray.full"
          />
        }
      >
        <WeekNav monday={monday} onChangeWeek={onChangeWeek} />
      </LargeScreenHeader>
      {/* Drag a card from one day onto another to reschedule it, or from the
          backlog onto a day to schedule it — the whole point of having the week
          on screen at once (DEX-77). */}
      <DragScheduleProvider>
        <View
          style={[
            styles.body,
            {
              gap: theme.space.sm,
              paddingHorizontal: theme.space.md,
              paddingTop: theme.space.md,
            },
          ]}
        >
          {/* A `DraxScrollView`, not a plain one, and that is load-bearing:
              drax hit-tests a drop against measurements taken at layout time,
              correcting each one by the scroll offset of its nearest *drax*
              scroll container. A plain ScrollView registers no such offset and
              scrolling fires no layout, so the moment the user scrolled the
              week sideways every column's hit box would be stale by exactly the
              distance scrolled and drops would land on the wrong day. It also
              brings the edge auto-scroll that makes an off-screen day reachable
              mid-drag. Every prop below is passed straight through to the
              ScrollView it wraps. */}
          <DraxScrollView
            horizontal
            onLayout={(event: LayoutChangeEvent) =>
              anchorToday(event.nativeEvent.layout.width)
            }
            ref={scrollRef}
            showsHorizontalScrollIndicator={false}
            style={styles.weekScroll}
            // `flexGrow: 1` is what lets the seven columns divide the full width
            // when they all fit; without it the row shrinks to its content and
            // the columns sit at their minimum against a gap of empty space.
            contentContainerStyle={[styles.weekRow, { gap: columnGap }]}
          >
            {days.map((day, index) => (
              // The drop target is the whole column, not its task list: the
              // column is `flex: 1` and full height whatever it contains, which
              // is what makes an *empty* day droppable — `WeekDayColumn` passes
              // `emptyMessage={null}`, so an empty one renders nothing at all.
              // Outlining the column also reads as "this day", which is the
              // thing being chosen.
              <TaskDropTarget
                key={day.toString()}
                scheduledFor={day.toString()}
                style={styles.column}
                testID={`week-drop-${day.toString()}`}
              >
                <WeekDayColumn
                  date={day}
                  enableHabits={enableHabits}
                  isToday={index === todayIndex}
                />
              </TaskDropTarget>
            ))}
          </DraxScrollView>
          {showDrawer && (
            // Dropping a scheduled card here clears its date and returns it to
            // the backlog — the inverse of dragging one out onto a day.
            <TaskDropTarget
              scheduledFor={null}
              testID="backlog-drop-target"
              style={[
                styles.drawerPane,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
            >
              <TaskDrawer daysOnScreen={days} date={targetDate} />
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
  // Gutter from `space.md`, the same token `LargeScreenHeader` above and
  // `columnGap` below read — which is what lets the anchor math derive the
  // column pitch and the grid read as evenly spaced rather than edge-heavy.
  body: {
    flex: 1,
    flexDirection: "row",
  },
  weekScroll: {
    flex: 1,
  },
  weekRow: {
    flexGrow: 1,
  },
  // The columns flex to share the row and stop shrinking at the minimum, at
  // which point the row scrolls sideways instead of squeezing TaskCard past
  // the width its controls need.
  column: {
    flex: 1,
    minWidth: WEEK_COLUMN_MIN_WIDTH,
  },
  // Docked outside the horizontal scroller so it stays put while the week
  // scrolls under it. Mirrors LargeScreenToday's drawerPane.
  drawerPane: {
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: DRAWER_PANE_MAX_WIDTH,
    minWidth: TASK_LIST_PANE_MIN_WIDTH,
    overflow: "hidden",
    width: DRAWER_PANE_MAX_WIDTH,
  },
});
