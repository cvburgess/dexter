import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
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

  const days = weekDays(monday);

  const scrollRef = useRef<ScrollView>(null);
  const viewportWidth = useRef(0);
  const contentWidth = useRef(0);
  // Guards the one-shot scroll per week: `onLayout` fires again on rotation
  // and on any re-layout, and re-scrolling then would yank the user back to
  // today after they had scrolled elsewhere. Keyed on the week so paging away
  // and back re-anchors.
  const anchoredWeek = useRef<string | null>(null);

  const anchorToday = (x: number) => {
    const key = monday.toString();
    if (anchoredWeek.current === key) return;
    if (!viewportWidth.current || !contentWidth.current) return;
    anchoredWeek.current = key;
    scrollRef.current?.scrollTo({
      // Anchors today in the left third rather than dead center, so the rest
      // of the week — the part you can still plan — stays in frame.
      x: scrollOffsetForTarget(x, viewportWidth.current, contentWidth.current),
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
          onContentSizeChange={(width) => {
            contentWidth.current = width;
          }}
          onLayout={(event: LayoutChangeEvent) => {
            viewportWidth.current = event.nativeEvent.layout.width;
          }}
          ref={scrollRef}
          showsHorizontalScrollIndicator={false}
          style={styles.weekScroll}
          // `flexGrow: 1` is what lets the seven columns divide the full width
          // when they all fit; without it the row shrinks to its content and
          // the columns sit at their minimum against a gap of empty space.
          contentContainerStyle={[styles.weekRow, { gap: theme.gap }]}
        >
          {days.map((day) => (
            <View
              key={day.toString()}
              onLayout={
                Temporal.Now.plainDateISO().equals(day)
                  ? (event: LayoutChangeEvent) =>
                      anchorToday(event.nativeEvent.layout.x)
                  : undefined
              }
              style={styles.column}
            >
              <WeekDayColumn date={day} enableHabits={enableHabits} />
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
            <TaskDrawer date={targetDate} weekStart={monday} />
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
