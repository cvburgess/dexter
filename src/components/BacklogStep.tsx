import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useMemo, useState } from "react";
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

import { ETaskPriority } from "@/api/tasks";
import { TaskDrawer } from "@/components/TaskDrawer";
import { useTasks } from "@/hooks/useTasks";
import {
  backlogCounts,
  defaultBacklogFilter,
  selectBacklogTasks,
  TBacklogCounts,
} from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

/**
 * The whole arrival, as one 0→1 with two overlapping windows onto it — the same
 * structure `CalendarStep` and `HoroscopeStep` use, and for the same reason: a
 * stagger built from one driver cannot drift out of order however the timings
 * are retuned. Matched to the calendar's timing rather than the horoscope's:
 * this hero also reports counts, and numbers that take seconds to arrive read
 * as an app struggling to add up.
 */
const REVEAL_MS = 1200;
const REVEAL_FADE = 0.7;
/** Start of each stage's window: the hero, then the backlog beneath it. */
const REVEAL_STARTS = [0, 0.3] as const;

/**
 * The hero's three lines, in the order they read — which is also the order
 * `defaultBacklogFilter` picks the opening filter in.
 */
const HERO_LINES = [
  { key: "leftBehind", label: "left behind" },
  { key: "overdue", label: "overdue" },
  { key: "dueSoon", label: "due soon" },
] as const satisfies readonly { key: keyof TBacklogCounts; label: string }[];

type TBacklogListProps = {
  /** The day a row's "+" schedules its task onto. */
  date: Temporal.PlainDate;
  /**
   * The counts as of this list's first render, read once to pick the opening
   * Filter preset and never again.
   */
  initialCounts: TBacklogCounts;
};

/**
 * The drawer half of the step, split out for the seeding: its parent renders it
 * only once the tasks have resolved *and* something needs attention, so a lazy
 * initializer here is a one-time latch that never sees `useTasks`'s empty
 * placeholder array.
 *
 * Which is the whole point of the split — the preset has to be pinned rather
 * than derived. Derived every render, the filter would move out from under the
 * reader the moment they cleared the last left-behind task and Overdue became
 * the first non-zero count.
 */
function BacklogList({ date, initialCounts }: TBacklogListProps) {
  const [filterId, setFilterId] = useState(() =>
    defaultBacklogFilter(initialCounts),
  );

  return (
    <TaskDrawer date={date} filterId={filterId} onFilterChange={setFilterId} />
  );
}

type TBacklogStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

/**
 * The morning ritual's Backlog step (DEX-141): what is slipping, counted, over
 * the same backlog drawer the Today tab docks.
 *
 * The counts and the drawer read the one `useTasks()` query and share a scope,
 * so scheduling a task onto the ritual's day drops it from the hero and the
 * list in the same render — which is the whole interaction here: the numbers go
 * down as you clear them.
 *
 * Carries no side gutter and no top inset of its own; `SwipeablePage` and the
 * ritual layouts own those (see docs/design.md, "Who owns spacing").
 */
export function BacklogStep({ date }: TBacklogStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [allTasks, { isLoading }] = useTasks();

  // Anchored to today rather than to `date`: `TaskDrawer` filters against today
  // whichever day the header is on, and a hero that disagreed with the list
  // under it would be worse than no hero. The *scope* is the ritual's day,
  // though — the same `[date]` the drawer defaults to — so a task scheduled
  // onto today's ritual leaves both at once.
  const counts = useMemo(
    () =>
      backlogCounts(
        selectBacklogTasks(allTasks, [date]),
        Temporal.Now.plainDateISO(),
      ),
    [allTasks, date],
  );
  const total = counts.leftBehind + counts.overdue + counts.dueSoon;

  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(0);
  // Held back until the counts exist, and keyed on the day rather than on
  // `allTasks` — a background refetch hands back a fresh array every time, and
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

  const drawerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      reveal.value,
      [REVEAL_STARTS[1], REVEAL_STARTS[1] + REVEAL_FADE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // The figure carries the color and the words stay in ink — the convention
  // `CalendarStep` set for its own split line. Coloring the words too reads as
  // three warnings rather than as three readings of one backlog. A zero is a
  // result worth stating in `success` rather than a count worth alarming about,
  // whichever line it lands on.
  const figureColor = (key: keyof TBacklogCounts, count: number): string => {
    if (count === 0) return theme.colors.success;
    // `priority[0]` is the daisyUI "warning" token (there is no dedicated
    // `warning` color — see `Theme.colors.priority` in `theme.ts`), which is
    // what "the same as urgent+important" means: due soon is a heads-up, not
    // the failure the other two are.
    return key === "dueSoon"
      ? theme.colors.priority[ETaskPriority.IMPORTANT_AND_URGENT]
      : theme.colors.error;
  };

  // Shared by both branches below: the all-clear state is these same three
  // lines, centered, rather than separate copy — a zero on every line is
  // already the good news.
  const heroLines = HERO_LINES.map(({ key, label }) => (
    <Text
      key={key}
      style={[
        styles.heroLine,
        theme.fonts.heading,
        { color: theme.colors.text },
      ]}
    >
      {/* The figure is its own node so its color can be asserted apart from
          the ink around it. */}
      <Text
        style={{ color: figureColor(key, counts[key]) }}
        testID={`backlog-count-${key}`}
      >
        {counts[key]}
      </Text>
      {` ${counts[key] === 1 ? "task" : "tasks"} ${label}`}
    </Text>
  ));

  // Checked *first*, and the order is load-bearing: `useTasks` hands back an
  // empty placeholder array while the query resolves, so every count is zero on
  // a cold open — testing the all-clear state ahead of this would flash "0
  // tasks left behind" at someone whose backlog is full. Nothing rather than a
  // spinner, for the same reason the calendar step shows nothing: one quick
  // read, and a spinner that appears for a frame reads as the step failing.
  if (isLoading) return null;

  if (total === 0) {
    return (
      <Animated.View
        style={[
          styles.allClear,
          {
            gap: theme.space.xs,
            padding: theme.space.lg,
            // The host SafeAreaView omits the bottom edge (the tab bar owns
            // it), so centering in the full box would sit this visibly low —
            // the same reservation `EmptyScreen` and the calendar step's
            // clear-day block make.
            paddingBottom: theme.space.lg + insets.bottom,
          },
          heroStyle,
        ]}
        testID="backlog-step-clear"
      >
        {heroLines}
      </Animated.View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        // `TaskDrawer` brings its own `md` padding, so this tops the gap up to
        // the group step the hero and the controls belong on either side of —
        // the same idiom the drawer uses between its search field and its list
        // (see docs/design.md, "Spacing").
        { gap: theme.space.lg - theme.space.md },
      ]}
    >
      <Animated.View style={[{ gap: theme.space.xs }, heroStyle]}>
        {heroLines}
      </Animated.View>
      {/* `flex: 1` belongs to this wrapper: `TaskDrawer` bounds its FlashList to
          its own `flex: 1` root, and an `Animated.View` sized to its content
          would give it nothing to fill. Opacity only, no translate —
          `SwipeablePage`'s intro already slides the page, and a second axis
          compounds into a diagonal drift. */}
      <Animated.View style={[styles.drawer, drawerStyle]}>
        <BacklogList date={date} initialCounts={counts} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  drawer: { flex: 1 },
  allClear: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  heroLine: { textAlign: "center" },
});
