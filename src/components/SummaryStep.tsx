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

/**
 * How long the figures and the button take to arrive, once the sky has.
 *
 * Long — most of the sunrise's own length again, for a step that takes about
 * four seconds end to end. The block has no stagger of its own to fill the time
 * (the figures land together, unlike the calendar and backlog heroes), so the
 * duration *is* the whole gesture: at 700ms it read as a switch being thrown
 * after the sky had finished, where drawn out it reads as the day surfacing out
 * of the light.
 */
const CONTENT_FADE_MS = 1800;

/** `1 habit` / `2 habits` — the same inline plural the backlog step's hero uses. */
const plural = (count: number, noun: string) =>
  `${noun}${count === 1 ? "" : "s"}`;

/**
 * The morning ritual's closing step: what the day adds up to, and the door out
 * to it. It closed the evening too until DEX-149 — see `utils/ritualSteps` for
 * why a count of a day already reviewed stopped being the last word there.
 *
 * **This is where the morning's task-list step went (DEX-144).** `DayTaskList`
 * dropped into the ritual worked and cost almost nothing — but it copied a
 * surface it could not replace, leaving two lists of the same day a swipe
 * apart, and the ritual is a sequence you walk once where the day's list is
 * what you return to all day. Reach for that history before re-proposing it.
 * Counting the day and handing the reader over closes on the same information
 * without owning it.
 *
 * Three figures, in the order the day is assembled — what you do every day,
 * what was already booked, what you chose this morning — then the line that
 * follows from them. **All three figures take `colors.primary`** rather than a
 * per-line sentiment: the calendar and backlog steps are reporting on something
 * that might be wrong, where this is a summary of a day the reader has just
 * finished planning, and none of its numbers is bad news.
 *
 * Carries no side gutter and no top inset of its own; `SwipeablePage` and the
 * ritual layouts own those (see docs/design.md, "Who owns spacing").
 */
export function SummaryStep({ date }: TSummaryStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isLargeDevice = useIsLargeDevice();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const [preferences] = usePreferences();
  // The day as a value rather than an object: it keys all three animations and
  // the link, and comparing `PlainDate` identity would restart them for an
  // equal-but-new one.
  const day = date.toString();

  // Active, unpaused habits scheduled for this weekday — the same selection
  // `HabitTracker` treats as the source of truth for a day, rather than
  // `useDailyHabits`, which answers how far along they are instead of how many
  // there are. Skipped outright when habits are off, so a user who turned the
  // feature off adds no observer for it.
  const [habits, { isLoading: habitsLoading }] = useHabits({
    skipQuery: !preferences.enableHabits,
    filters: [
      ...habitFilters.notPaused,
      ...habitFilters.activeForDay(date.dayOfWeek),
    ],
  });
  // Safe to call unconditionally: the hook reads `enableCalendar` itself and
  // disables its query, so a user with no calendar touches no device API here.
  const [events, { isLoading: eventsLoading }] = useCalendarEvents(date);
  const [allTasks, { isLoading: tasksLoading }] = useTasks();
  const tasks = useMemo(
    () => selectTasksForDate(allTasks, date),
    [allTasks, date],
  );

  // A line per *feature the reader has*, not per non-zero count: a zero is a
  // reading worth stating ("0 tasks" is why the button is there), but a line
  // about calendars for someone with no calendar is noise. `HeroLines` maps
  // lines onto stages by index, so a shorter list simply uses fewer.
  //
  // **The figures and the total are derived from this one list**, rather than
  // the total being summed from the three hooks directly. A disabled query
  // keeps serving whatever it last cached — turning habits off does not empty
  // `habits` for someone who had them — so a total that counted hidden rows
  // would hold a day with nothing visible on it out of the blank-canvas state
  // and render a lone "0 tasks" instead.
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

  // **The blank day's driver, and only its.** Its message takes the first stage
  // and its button the second — the one branch that still staggers, since it
  // has no sunrise to sequence against (see below). Held at `null` on every
  // other path, so a counted day doesn't run a 3.6s timing nothing reads.
  const reveal = useHeroReveal(isLoading || total > 0 ? null : day);
  const blankStyle = useStageOpacity(reveal, 0);
  const blankCloseStyle = useStageOpacity(reveal, 1);

  // **The counted day's content does not stagger.** The figures and the button
  // arrive together, as one block, once the sunrise behind them has settled —
  // so the step reads as a sky coming up and then the day being handed over,
  // rather than as two sequences running against each other. Counting the
  // figures off one at a time is what the calendar and backlog steps do, and
  // here it competed with the bands for the same stretch of time.
  const content = useSharedValue(0);
  useEffect(() => {
    if (isLoading) {
      content.value = 0;
      return;
    }
    if (reduceMotion) {
      // Assigned rather than skipped, so a fade already in flight is cancelled
      // when the setting is turned on mid-step — the rule `useHeroReveal` and
      // the sunrise both follow.
      content.value = 1;
      return;
    }
    content.value = 0;
    content.value = withDelay(
      SUNRISE_MS,
      withTiming(1, { duration: CONTENT_FADE_MS }),
    );
    // `date.toString()`, not `date`: the same key the reveal and the sunrise
    // take, so all three restart together on a day change rather than this one
    // also restarting for an equal-but-new `PlainDate`.
  }, [content, isLoading, reduceMotion, day]);
  const contentStyle = useAnimatedStyle(() => ({ opacity: content.value }));

  // `HeroLines` staggers its lines by index onto one driver. Pinned at 1, every
  // line resolves to fully visible immediately and the wrapper above owns the
  // arrival instead — which is how the block fades in as a unit without this
  // step needing a variant of a component two other steps depend on.
  const pinnedReveal = useSharedValue(1);

  const navigationCount = useRef(0);
  const openDay = () => {
    // Cross-tab navigation reuses the mounted Today screen and only swaps its
    // params, so two presses carrying one date would be identical and the
    // second would switch tabs and do nothing else. A counter rather than a
    // timestamp, so the link stays deterministic in tests — the same shape the
    // Search tab uses (see `TTodayRouteParams["n"]`).
    navigationCount.current += 1;
    router.push(
      todayRoute({
        date: day,
        mode: "tasks",
        n: String(navigationCount.current),
      }),
    );
  };

  // Checked first, and the order is load-bearing: every hook above hands back
  // an empty placeholder while its query resolves, so a cold open counts as a
  // blank day — testing that state ahead of this would tell someone with a full
  // morning that they have nothing on.
  if (isLoading) return null;

  const startButton = (
    <Button onPress={openDay} variant="primary">
      Start Your Day
    </Button>
  );

  // The ritual layout has already pushed this step's box down by its step
  // inset, so a block centered inside the box lands half that inset below the
  // middle of the space the reader actually sees. Paid back as bottom padding
  // in both branches below, which re-centers the *content* rather than the box.
  const insetAbove = ritualStepInsetTop(theme.space, isLargeDevice);

  if (total === 0) {
    return (
      <View
        style={[
          styles.blank,
          {
            gap: theme.space.lg,
            padding: theme.space.lg,
            // Its own `lg` is already symmetric, so this branch owes only the
            // step inset — plus `insets.bottom`, since the host SafeAreaView
            // omits the bottom edge (the tab bar owns it) and centering in the
            // full box would otherwise sit this visibly low. The same
            // reservation `EmptyScreen` and the calendar step's clear-day block
            // make.
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
    // Figures and button centered as one block. No side gutter or padding of
    // its own beyond the bottom inset — `HeroLines` brings its own vertical
    // breathing room and `SwipeablePage` the gutter.
    <View
      style={[
        styles.container,
        {
          // The step inset (see `insetAbove`), plus `HeroLines`' own `lg` of
          // top padding — which sits inside the centered block with nothing
          // matching it under the button, so the box is taller above the
          // figures than below them and the content reads low by half the
          // difference. Both are paid back here.
          //
          // `insets.bottom` on top of that, since the host SafeAreaView omits
          // the bottom edge (the tab bar owns it) — the same reservation the
          // blank branch and the calendar step's clear-day block make.
          paddingBottom: insets.bottom + insetAbove + theme.space.lg,
        },
      ]}
      testID="summary-step"
    >
      {/* First child, so it paints under the figures and the button without
          either needing a z-index. It is absolutely filled and takes no part in
          the centering above. */}
      <SunriseBackground revealKey={day} />
      {/* Figures and button under one opacity, so they arrive as a unit.
          `bodyInsetTop` cancels the compensation `HeroLines` adds below itself
          for the step inset: that compensation is right for a hero anchored to
          the top of the step, which is what the calendar and backlog steps
          have — here the block is centered instead, so it would only widen the
          gap to the button. Zeroing it leaves `lg` above and below the
          figures. */}
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
  // Figures and button as one centered block, rather than the hero-on-top,
  // body-below shape the calendar and backlog steps take — there is no body
  // here to fill the space, so hanging the figures from the top would leave the
  // step bottom-empty.
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  // Centers the figures over the button; the container above centers this.
  content: { alignItems: "center" },
  // The blank day has no hero to hang from, so the one line and the button
  // center in the whole step instead.
  blank: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  line: { textAlign: "center" },
});
