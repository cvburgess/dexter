import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { Button } from "@/components/Button";
import {
  HeroLines,
  type THeroLine,
  useHeroReveal,
  useStageOpacity,
} from "@/components/HeroLines";
import { SUNRISE_MS, SunriseBackground } from "@/components/SunriseBackground";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { habitFilters, useHabits } from "@/hooks/useHabits";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";
import { ritualStepInsetTop } from "@/utils/ritualSteps";
import { selectTasksForDate } from "@/utils/taskFilters";
import { todayRoute } from "@/utils/todayRoute";
import { useTheme } from "@/utils/theme";

type TSummaryStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

// Deliberately long: the figures land as one block with no stagger of their
// own, so the fade duration is the whole gesture — 700ms read as a switch flip.
const CONTENT_FADE_MS = 1800;

/** `1 habit` / `2 habits` — the same inline plural the backlog step's hero uses. */
const plural = (count: number, noun: string) =>
  `${noun}${count === 1 ? "" : "s"}`;

// The morning ritual's closing step (DEX-144). All three figures take
// colors.primary — none of this day's numbers is bad news.
export function SummaryStep({ date }: TSummaryStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isLargeDevice = useIsLargeDevice();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const [preferences] = usePreferences();
  // A value, not the PlainDate object — identity comparison would restart
  // the animations for an equal-but-new one.
  const day = date.toString();

  // How many habits exist for the day, not how far along they are —
  // useHabits, same source HabitTracker treats as truth, not useDailyHabits.
  const [habits, { isLoading: habitsLoading }] = useHabits({
    skipQuery: !preferences.enableHabits,
    filters: [
      ...habitFilters.notPaused,
      ...habitFilters.activeForDay(date.dayOfWeek),
    ],
  });
  const [events, { isLoading: eventsLoading }] = useCalendarEvents(date);
  const [allTasks, { isLoading: tasksLoading }] = useTasks();
  const tasks = useMemo(
    () => selectTasksForDate(allTasks, date),
    [allTasks, date],
  );

  // Total derived from this filtered list, not summed from raw hooks — a
  // disabled query's stale cache would count hidden rows and hide blank-canvas.
  const counts = [
    {
      key: "habits",
      noun: "habit",
      count: habits.length,
      shown: preferences.enableHabits,
    },
    {
      key: "events",
      noun: "event",
      count: events.length,
      shown: preferences.enableCalendar,
    },
    { key: "tasks", noun: "task", count: tasks.length, shown: true },
  ].filter((line) => line.shown);

  const heroLines: THeroLine[] = counts.map(({ key, noun, count }) => ({
    key,
    figure: String(count),
    words: plural(count, noun),
    color: theme.colors.primary,
  }));

  const total = counts.reduce((sum, line) => sum + line.count, 0);
  const isLoading = habitsLoading || eventsLoading || tasksLoading;

  // Blank-day driver only — its message/button still stagger since there's no
  // sunrise to sequence against. Null on every other path.
  const reveal = useHeroReveal(isLoading || total > 0 ? null : day);
  const blankStyle = useStageOpacity(reveal, 0);
  const blankCloseStyle = useStageOpacity(reveal, 1);

  // Counted-day content doesn't stagger — figures and button arrive as one
  // block once the sunrise settles, rather than competing with its bands.
  const content = useSharedValue(0);
  useEffect(() => {
    if (isLoading) {
      content.value = 0;
      return;
    }
    if (reduceMotion) {
      // Assigned, not skipped — cancels a fade already in flight if the
      // setting flips mid-step, same rule useHeroReveal and the sunrise follow.
      content.value = 1;
      return;
    }
    content.value = 0;
    content.value = withDelay(
      SUNRISE_MS,
      withTiming(1, { duration: CONTENT_FADE_MS }),
    );
    // `day`, not `date` — same key the reveal/sunrise use, so all three
    // restart together rather than this one also firing for an equal PlainDate.
  }, [content, isLoading, reduceMotion, day]);
  const contentStyle = useAnimatedStyle(() => ({ opacity: content.value }));

  // Pinned at 1 so HeroLines' own per-line stagger is skipped and the wrapper
  // above owns the arrival — the block fades in as a unit.
  const pinnedReveal = useSharedValue(1);

  const navigationCount = useRef(0);
  const openDay = () => {
    // Counter, not a timestamp, so tests stay deterministic — same shape as
    // the Search tab's `n`.
    navigationCount.current += 1;
    router.push(
      todayRoute({
        date: day,
        mode: "tasks",
        n: String(navigationCount.current),
      }),
    );
  };

  // Checked first: hooks above serve empty placeholders while resolving,
  // which would otherwise read as a genuinely blank day.
  if (isLoading) return null;

  const startButton = (
    <Button onPress={openDay} variant="primary">
      Start Your Day
    </Button>
  );

  // The layout already pushed the box down by this inset, so a centered block
  // lands off-center; paid back as bottom padding to re-center the content.
  const insetAbove = ritualStepInsetTop(theme.space, isLargeDevice);

  if (total === 0) {
    return (
      <View
        style={[
          styles.blank,
          {
            gap: theme.space.lg,
            padding: theme.space.lg,
            // insets.bottom because the host SafeAreaView omits the bottom
            // edge (same reservation EmptyScreen and the calendar step make).
            paddingBottom: theme.space.lg + insets.bottom + insetAbove,
          },
        ]}
        testID="summary-step-blank"
      >
        <Animated.Text
          style={[
            styles.line,
            theme.fonts.heading,
            { color: theme.colors.text },
            blankStyle,
          ]}
        >
          Today is a blank canvas, go make something beautiful.
        </Animated.Text>
        <Animated.View style={blankCloseStyle}>{startButton}</Animated.View>
      </View>
    );
  }

  return (
    // Figures and button as one centered block; SwipeablePage owns the gutter.
    <View
      style={[
        styles.container,
        // insetAbove + HeroLines' unmatched top `lg` + insets.bottom, paid
        // back here to re-center the content.
        { paddingBottom: insets.bottom + insetAbove + theme.space.lg },
      ]}
      testID="summary-step"
    >
      {/* First child so it paints under the block without a z-index. */}
      <SunriseBackground revealKey={day} />
      {/* bodyInsetTop zeroes HeroLines' own top-anchor compensation, which
          would otherwise just widen the gap to the button here. */}
      <Animated.View style={[styles.content, contentStyle]}>
        <HeroLines
          bodyInsetTop={insetAbove}
          lines={heroLines}
          reveal={pinnedReveal}
        />
        {startButton}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Centered block, unlike the calendar/backlog steps' hero-on-top shape —
  // there's no body here to fill the space below.
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  content: { alignItems: "center" },
  blank: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  line: { textAlign: "center" },
});
