import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GlassIconButton } from "@/components/GlassIconButton";
import { TaskDrawer } from "@/components/TaskDrawer";
import { WeekDayColumn } from "@/components/WeekDayColumn";
import { WeekNav } from "@/components/WeekNav";
import {
  DRAWER_PANE_MAX_WIDTH,
  WEEK_COLUMN_MIN_WIDTH,
} from "@/utils/breakpoints";
import { scrollOffsetForTarget } from "@/utils/calendarLayout";
import { useTheme, withOpacity } from "@/utils/theme";
import { weekDays } from "@/utils/weekStartEnd";

type TWeekViewProps = {
  /** The Monday of the week on screen. */
  monday: Temporal.PlainDate;
  onChangeWeek: (monday: Temporal.PlainDate) => void;
  /**
   * The day the header's "+" and the backlog's per-row "+" schedule onto —
   * today when it falls inside this week, otherwise the week's Monday. Chosen
   * by the route so both entry points agree; see `week/index.tsx`.
   */
  targetDate: Temporal.PlainDate;
  enableHabits: boolean;
};

/**
 * The Week tab's large-screen layout (DEX-96): week navigation over seven day
 * columns, with an optional docked backlog — the legacy dexter-app's Week view
 * minus drag-and-drop, which is descoped.
 *
 * Header metrics are shared with `LargeScreenToday` so switching tabs doesn't
 * shift the nav row.
 */
export function WeekView({
  monday,
  onChangeWeek,
  targetDate,
  enableHabits,
}: TWeekViewProps) {
  const theme = useTheme();
  const router = useRouter();
  // Local rather than `useTodayPanes`: sharing the `drawer` pane would mean
  // opening the backlog here also opened it on Today, and the legacy view
  // didn't persist its Quick Planner toggle either.
  const [showDrawer, setShowDrawer] = useState(false);

  // Memoized because `date` identity propagates: `DayTaskList` memoizes its
  // per-day filter on it, and `HabitTracker`'s row-bootstrapping effect lists
  // it as a dependency — a fresh array each render would re-filter seven task
  // lists and re-fire that write effect on every unrelated re-render.
  const days = useMemo(() => weekDays(monday), [monday]);
  // Read once rather than per column: `Temporal.Now.plainDateISO()` resolves
  // the system time zone on every call, making it the most expensive Temporal
  // operation by a wide margin. Also keeps a render that straddles midnight
  // internally consistent.
  const today = Temporal.Now.plainDateISO();
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
  const columnPitch = WEEK_COLUMN_MIN_WIDTH + theme.gap;
  const minContentWidth = 7 * WEEK_COLUMN_MIN_WIDTH + 6 * theme.gap;

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

  const openNewTask = () =>
    router.push({
      pathname: "/new-task",
      params: { scheduledFor: targetDate.toString() },
    });

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: withOpacity(theme.colors.text, 0.1) },
        ]}
      >
        <WeekNav monday={monday} onChangeWeek={onChangeWeek} />
        <View style={[styles.headerActions, { gap: theme.gap }]}>
          <GlassIconButton
            accessibilityLabel="Toggle task drawer pane"
            active={showDrawer}
            ionicon="file-tray-full-outline"
            onPress={() => setShowDrawer((open) => !open)}
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
      <View style={[styles.body, { gap: theme.gap }]}>
        <ScrollView
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
          contentContainerStyle={[styles.weekRow, { gap: theme.gap }]}
        >
          {days.map((day, index) => (
            <View key={day.toString()} style={styles.column}>
              <WeekDayColumn
                date={day}
                enableHabits={enableHabits}
                isToday={index === todayIndex}
              />
            </View>
          ))}
        </ScrollView>
        {showDrawer && (
          <View
            style={[
              styles.drawerPane,
              {
                borderColor: withOpacity(theme.colors.text, 0.1),
                borderRadius: theme.borderRadius,
              },
            ]}
          >
            <TaskDrawer daysOnScreen={days} date={targetDate} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Same metrics as LargeScreenToday's multiPaneHeader: WeekNav carries its own
  // 12pt vertical padding, so 4pt here brings the row to 16pt overall, matching
  // the sides.
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
  },
  body: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
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
    minWidth: 280,
    overflow: "hidden",
    width: DRAWER_PANE_MAX_WIDTH,
  },
});
