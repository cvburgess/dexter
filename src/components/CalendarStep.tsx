import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Button } from "@/components/Button";
import { CalendarView } from "@/components/CalendarView";
import { EmptyScreen } from "@/components/EmptyScreen";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { usePreferences } from "@/hooks/usePreferences";
import { calendarWindow, summarizeDay } from "@/utils/calendarStats";
import { formatDuration } from "@/utils/formatPlainTime";
import { useTheme } from "@/utils/theme";

/**
 * The whole arrival, as one 0→1 with two overlapping windows onto it — the same
 * structure `HoroscopeStep` uses, and for the same reason: a stagger built from
 * one driver cannot drift out of order however the timings are retuned.
 *
 * Far shorter than the horoscope's 3.6 seconds. That step is producing a
 * reading and its slowness is the conceit; this one reports three numbers, and
 * numbers that take seconds to arrive read as an app struggling to add up.
 */
const REVEAL_MS = 1200;
const REVEAL_FADE = 0.7;
/** Start of each stage's window: the hero, then the calendar beneath it. */
const REVEAL_STARTS = [0, 0.3] as const;

type TCalendarStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

/**
 * The morning ritual's Calendar step (DEX-140): what the day already holds,
 * stated in a line or three, over the same timeline the Today tab draws.
 *
 * The step only exists at all while `preferences.enableCalendar` is on —
 * `utils/ritualSteps` drops it from the flow otherwise — so everything here is
 * about the two states left underneath that: a calendar switched on but with no
 * source behind it, and a calendar with a day in it.
 *
 * Carries no side gutter and no top inset of its own; `SwipeablePage` and the
 * ritual layouts own those (see docs/design.md, "Who owns spacing").
 */
export function CalendarStep({ date }: TCalendarStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [preferences] = usePreferences();
  const [events, { isLoading, isError, permissionDenied, notConfigured }] =
    useCalendarEvents(date);

  const summary = useMemo(() => {
    const { startMin, endMin } = calendarWindow(
      preferences.calendarStartTime,
      preferences.calendarEndTime,
    );
    return summarizeDay(events, date, startMin, endMin);
  }, [
    date,
    events,
    preferences.calendarStartTime,
    preferences.calendarEndTime,
  ]);

  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(0);
  // Held back until the day's numbers exist, and keyed on the day rather than
  // on `events` — a background refetch hands back a fresh array every time, and
  // the hero must not fade out from under someone re-reading it. Walking
  // `DayNav` replays the reveal by remounting the whole step (`ritualPageKey`),
  // so this key's only job is the wait.
  const revealKey = isLoading ? null : date.toString();

  useEffect(() => {
    if (!revealKey) {
      reveal.value = 0;
      return;
    }
    if (reduceMotion) {
      // Assigned rather than skipped: a plain write cancels whatever is running
      // on the value, which is what stops a reveal mid-flight when the setting
      // is turned on while the step is on screen.
      reveal.value = 1;
      return;
    }
    reveal.value = 0;
    reveal.value = withTiming(1, {
      duration: REVEAL_MS,
      // Linear, because the curve the eye reads here is the overlap of the two
      // windows rather than the easing of the driver behind them.
      easing: Easing.linear,
    });
  }, [reduceMotion, reveal, revealKey]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      reveal.value,
      [REVEAL_STARTS[0], REVEAL_STARTS[0] + REVEAL_FADE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const calendarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      reveal.value,
      [REVEAL_STARTS[1], REVEAL_STARTS[1] + REVEAL_FADE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Loading is checked *first*, and the order is load-bearing: an unresolved
  // read looks exactly like a user with no calendars, so testing the source
  // ahead of it would flash the setup prompt — and its button — at a configured
  // user on every cold open. Nothing rather than a spinner, for the same reason
  // the horoscope shows nothing: one quick read, and a spinner that appears for
  // a frame reads as the step failing.
  if (isLoading) return null;

  if (notConfigured) {
    return (
      <EmptyScreen
        message={
          permissionDenied
            ? "Dexter can't see your calendar yet."
            : "No calendars yet. Pick the ones you want to see each morning."
        }
      >
        <Button
          onPress={() => router.push("/settings/calendars")}
          variant="primary"
        >
          Set up calendars
        </Button>
      </EmptyScreen>
    );
  }

  // A dropped connection is not a configuration problem, so it gets the plain
  // message rather than a button offering to fix something that isn't broken.
  if (isError && events.length === 0) {
    return (
      <EmptyScreen message="Couldn't load your calendars. Check your connection or feed URLs." />
    );
  }

  if (summary.eventCount === 0) {
    return (
      <Animated.View
        style={[
          styles.clearDay,
          {
            gap: theme.space.xs,
            padding: theme.space.lg,
            // The host SafeAreaView omits the bottom edge (the tab bar owns
            // it), so centering in the full box would sit this visibly low —
            // the same reservation `EmptyScreen` makes, and why this is a local
            // block rather than that component: two lines, two colors.
            paddingBottom: theme.space.lg + insets.bottom,
          },
          heroStyle,
        ]}
        testID="calendar-step-clear"
      >
        <Text
          style={[
            styles.heroLine,
            theme.fonts.heading,
            { color: theme.colors.text },
          ]}
        >
          No events today
        </Text>
        <Text
          style={[
            styles.heroLine,
            theme.fonts.heading,
            { color: theme.colors.success },
          ]}
        >
          Enjoy the space
        </Text>
      </Animated.View>
    );
  }

  return (
    <View style={[styles.container, { gap: theme.space.lg }]}>
      <Animated.View style={[{ gap: theme.space.xs }, heroStyle]}>
        <Text style={[theme.fonts.heading, { color: theme.colors.text }]}>
          {summary.eventCount === 1
            ? "1 event today"
            : `${summary.eventCount} events today`}
        </Text>
        {/* The figure carries the color and the word stays in ink: what the
            reader is weighing is how much of the day is spoken for, not the
            word "planned". */}
        <Text style={[theme.fonts.heading, { color: theme.colors.text }]}>
          <Text style={{ color: theme.colors.error }}>
            {formatDuration(summary.plannedMinutes)}
          </Text>
          {" planned"}
        </Text>
        <Text style={[theme.fonts.heading, { color: theme.colors.text }]}>
          <Text style={{ color: theme.colors.success }}>
            {formatDuration(summary.freeMinutes)}
          </Text>
          {" free"}
        </Text>
      </Animated.View>
      {/* `flex: 1` belongs to this wrapper: `CalendarView` fills its parent, and
          an `Animated.View` sized to its content would give it nothing to fill.
          Opacity only, no translate — `SwipeablePage`'s intro already slides the
          page 25px, a second axis compounds into a diagonal drift, and sliding a
          grid past its own fixed hour gutter reads as a scroll the user never
          made. */}
      <Animated.View style={[styles.calendar, calendarStyle]}>
        <CalendarView date={date} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  calendar: { flex: 1 },
  clearDay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  heroLine: { textAlign: "center" },
});
