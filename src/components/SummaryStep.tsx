import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { Button } from "@/components/Button";
import {
  HeroLines,
  type THeroLine,
  useHeroReveal,
  useStageOpacity,
} from "@/components/HeroLines";
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

/** `1 habit` / `2 habits` — the same inline plural the backlog step's hero uses. */
const plural = (count: number, noun: string) =>
  `${noun}${count === 1 ? "" : "s"}`;

/**
 * The ritual's closing step: what the day adds up to, and the door out to it.
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
  const router = useRouter();
  const [preferences] = usePreferences();

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

  // Held back until every count exists, so the sequence waits rather than
  // running against three placeholder zeros.
  const reveal = useHeroReveal(isLoading ? null : date.toString());
  // Straight after the last figure, rather than at `BODY_STAGE`. That constant
  // means "after all three hero lines" and is right for the two steps that
  // always draw three — but this one draws as few as one, and waiting for stage
  // 3 there would leave the close missing for most of a 3.6s sequence.
  const closeStyle = useStageOpacity(reveal, heroLines.length);
  // The blank day has no figures, so its message takes the first stage itself
  // and the button the second.
  const blankStyle = useStageOpacity(reveal, 0);
  const blankCloseStyle = useStageOpacity(reveal, 1);

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
        date: date.toString(),
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

  if (total === 0) {
    return (
      <View
        style={[
          styles.blank,
          {
            gap: theme.space.lg,
            padding: theme.space.lg,
            // The host SafeAreaView omits the bottom edge (the tab bar owns
            // it), so centering in the full box would sit this visibly low —
            // the same reservation `EmptyScreen` and the calendar step's
            // clear-day block make.
            paddingBottom: theme.space.lg + insets.bottom,
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
          // The host SafeAreaView omits the bottom edge (the tab bar owns it),
          // so centering in the full box would sit this visibly low — the same
          // reservation the blank branch and the calendar step's clear-day
          // block make.
          paddingBottom: insets.bottom,
        },
      ]}
      testID="summary-step"
    >
      {/* `bodyInsetTop` cancels the compensation `HeroLines` adds below itself
          for the ritual layout's step inset. That compensation is right for a
          hero anchored to the top of the step, which is what the calendar and
          backlog steps have — here the block is centered instead, so the extra
          padding would only make it bottom-heavy and pull the figures above
          true center. Zeroing it leaves `lg` above and below them. */}
      <HeroLines
        bodyInsetTop={ritualStepInsetTop(theme.space, isLargeDevice)}
        lines={heroLines}
        reveal={reveal}
      />
      <Animated.View style={closeStyle}>{startButton}</Animated.View>
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
  // The blank day has no hero to hang from, so the one line and the button
  // center in the whole step instead.
  blank: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  line: { textAlign: "center" },
});
