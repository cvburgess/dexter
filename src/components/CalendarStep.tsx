import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { ETaskPriority } from "@/api/tasks";
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
import { formatHours } from "@/utils/formatPlainTime";
import { useTheme } from "@/utils/theme";

type TCalendarStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

/** `hour` only at exactly sixty minutes; `hours` for everything else — reads
 * off the minutes since `"1"` is the only figure this can singularize. */
const hoursLabel = (minutes: number): string =>
  Math.round(Math.max(0, minutes)) === 60 ? "hour" : "hours";

/**
 * The morning Calendar step (DEX-140), over the Today tab's own timeline.
 * `utils/ritualSteps` drops it entirely when `enableCalendar` is off, so this
 * only handles: a calendar with no source, and a calendar with a day in it.
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

  // A line each, in the order they read — stacking booked and free (once one
  // bulleted sentence) puts all three figures on the same vertical line.
  const heroLines: THeroLine[] = [
    {
      key: "events",
      figure: String(summary.eventCount),
      words: summary.eventCount === 1 ? "event" : "events",
      // Same "warning" token as the backlog step's due-soon figure: a
      // heads-up register, neither the `error` below nor a neutral caption.
      color: theme.colors.priority[ETaskPriority.IMPORTANT_AND_URGENT],
    },
    // The unit sits in the words, not the figure, so the column measures
    // only the number — "1.5"/"12" line up where "1h 30m"/"12h" could not.
    {
      key: "planned",
      figure: formatHours(summary.plannedMinutes),
      words: `${hoursLabel(summary.plannedMinutes)} planned`,
      color: theme.colors.error,
    },
    {
      key: "free",
      figure: formatHours(summary.freeMinutes),
      words: `${hoursLabel(summary.freeMinutes)} free`,
      color: theme.colors.success,
    },
  ];

  // Checked first: an unresolved read looks like "no calendars", so testing
  // that ahead of loading would flash the setup prompt at a configured user.
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

  // Not a configuration problem, so the plain message, no fix-it button.
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
            // The same bottom reservation EmptyScreen makes — local here for
            // the two-line, two-color copy.
            paddingBottom: theme.space.lg + insets.bottom,
          },
        ]}
        testID="calendar-step-clear"
      >
        {/* Staged like the populated hero's first two lines; centered, not
            columned — no figure here to align against. */}
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
      {/* flex: 1 gives CalendarView something to fill. Opacity only — a second
          translate axis would drift diagonally and read as a scroll the user
          never made against the fixed hour gutter. */}
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
