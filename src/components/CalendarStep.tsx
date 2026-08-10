import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { Button } from "@/components/Button";
import { CalendarView } from "@/components/CalendarView";
import { EmptyScreen } from "@/components/EmptyScreen";
import {
  BODY_STAGE,
  HeroLines,
  type THeroLine,
  useHeroReveal,
  useStageOpacity,
} from "@/components/HeroLines";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { usePreferences } from "@/hooks/usePreferences";
import { calendarWindow, summarizeDay } from "@/utils/calendarStats";
import { formatDuration } from "@/utils/formatPlainTime";
import { useTheme } from "@/utils/theme";

type TCalendarStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

/**
 * The morning ritual's Calendar step (DEX-140): what the day already holds,
 * stated in a line or two, over the same timeline the Today tab draws.
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

  // Held back until the day's numbers exist, so the sequence waits rather than
  // running against an unresolved read.
  const reveal = useHeroReveal(isLoading ? null : date.toString());
  const calendarStyle = useStageOpacity(reveal, BODY_STAGE);
  // The clear-day block has no figures and so no column; it takes the first two
  // stages directly.
  const firstLineStyle = useStageOpacity(reveal, 0);
  const secondLineStyle = useStageOpacity(reveal, 1);

  // A line each, in the order they read: how many, then what they cost, then
  // what is left. Booked and free shared one line while the hero was centered —
  // one fact read two ways, split by a bullet — but in the column they are two
  // figures of the same kind, and stacking them puts all three on the same
  // vertical line rather than hiding two of them inside a sentence.
  const heroLines: THeroLine[] = [
    {
      key: "events",
      figure: String(summary.eventCount),
      words: summary.eventCount === 1 ? "event" : "events",
      // Ink, not an accent: the count is the neutral fact the other two lines
      // qualify.
      color: theme.colors.text,
    },
    {
      key: "planned",
      figure: formatDuration(summary.plannedMinutes),
      words: "planned",
      color: theme.colors.error,
    },
    {
      key: "free",
      figure: formatDuration(summary.freeMinutes),
      words: "free",
      color: theme.colors.success,
    },
  ];

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
      <View
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
        ]}
        testID="calendar-step-clear"
      >
        {/* Staged like the first two lines of the populated hero: the fact,
            then the invitation that follows from it. Centered rather than
            columned — there is no figure here to align against. */}
        <Animated.Text
          style={[
            styles.heroLine,
            theme.fonts.heading,
            { color: theme.colors.text },
            firstLineStyle,
          ]}
        >
          No events today
        </Animated.Text>
        <Animated.Text
          style={[
            styles.heroLine,
            theme.fonts.heading,
            { color: theme.colors.success },
            secondLineStyle,
          ]}
        >
          Enjoy the space
        </Animated.Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeroLines lines={heroLines} reveal={reveal} />
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
