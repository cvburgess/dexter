import { Temporal } from "@js-temporal/polyfill";
import { useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { DraxScrollView } from "react-native-drax";
import { useAnimatedRef } from "react-native-reanimated";
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
  /** The day the backlog's "+" schedules onto — today when inside this week,
   * else the week's Monday; see week/index.tsx. */
  targetDate: Temporal.PlainDate;
  enableHabits: boolean;
  /** Passed down, not read from the clock, so this and `targetDate` share one
   * instant — reading separately let them disagree across a midnight rollover. */
  today: Temporal.PlainDate;
};

// The Week tab's large-screen layout (DEX-96): nav over seven columns with an
// optional docked backlog, including drag-to-reschedule (DEX-77).
export function WeekView({
  monday,
  onChangeWeek,
  targetDate,
  enableHabits,
  today,
}: TWeekViewProps) {
  const theme = useTheme();
  // Local, not `useTodayPanes` — sharing the pane would open the backlog on
  // Today too.
  const [showDrawer, setShowDrawer] = useState(false);

  // Memoized because `date` identity propagates into per-day filters and
  // HabitTracker's bootstrap effect deps — a fresh array re-fires both.
  const days = useMemo(() => weekDays(monday), [monday]);
  const todayIndex = days.findIndex((day) => day.equals(today));

  // Animated so a pressed card can pause it from the UI thread (DEX-207).
  const scrollRef = useAnimatedRef<ScrollView>();
  // Guards against onLayout re-firing on any re-layout, which would yank the
  // user back to today. Keyed on the week so paging weeks stays put.
  const anchoredWeek = useRef<string | null>(null);

  const [viewportWidth, setViewportWidth] = useState(0);
  const columnGap = theme.space.md;
  // Explicit, not `flex: 1`: in the scroller's indefinite width columns sized
  // to content, and cards' matchContents menu hosts stopped stretching (DEX-222).
  const columnWidthFor = (viewport: number) =>
    Math.max(WEEK_COLUMN_MIN_WIDTH, (viewport - 6 * columnGap) / 7);

  const anchorToday = (viewport: number) => {
    const key = monday.toString();
    if (todayIndex < 0 || anchoredWeek.current === key) return;
    anchoredWeek.current = key;
    const width = columnWidthFor(viewport);
    scrollRef.current?.scrollTo({
      // Anchors today in the left third rather than dead center, so the rest
      // of the week — the part you can still plan — stays in frame.
      x: scrollOffsetForTarget(
        todayIndex * (width + columnGap),
        viewport,
        7 * width + 6 * columnGap,
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
      {/* Drag a card between days, or to/from the backlog (DEX-77). */}
      {/* Web's drag doesn't race the scroller (drax sets touch-action there),
          and `setNativeProps` is native-only. */}
      <DragScheduleProvider
        pauseScrollRef={Platform.OS === "web" ? undefined : scrollRef}
      >
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
          {/* DraxScrollView, not plain: drax corrects hit-test offsets by
              scroll position, and a plain ScrollView registers none. */}
          <DraxScrollView
            horizontal
            onLayout={(event: LayoutChangeEvent) => {
              setViewportWidth(event.nativeEvent.layout.width);
              anchorToday(event.nativeEvent.layout.width);
            }}
            ref={scrollRef}
            // Halves drax's default JS callback rate — one frame's lag is
            // imperceptible for hit-box correction.
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            style={styles.weekScroll}
            testID="week-scroll"
            contentContainerStyle={{ gap: columnGap }}
          >
            {days.map((day, index) => (
              // The drop target is the whole column, full-height regardless
              // of content — what makes an empty day droppable.
              <TaskDropTarget
                key={day.toString()}
                scheduledFor={day.toString()}
                style={{ width: columnWidthFor(viewportWidth) }}
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
  // Gutter from `space.md`, shared with `columnGap` so the anchor math and
  // the grid's spacing can't drift apart.
  body: {
    flex: 1,
    flexDirection: "row",
  },
  weekScroll: {
    flex: 1,
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
