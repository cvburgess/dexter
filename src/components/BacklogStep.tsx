import { Temporal } from "@js-temporal/polyfill";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ETaskPriority } from "@/api/tasks";
import { TaskDrawer } from "@/components/TaskDrawer";
import { useTasks } from "@/hooks/useTasks";
import {
  BACKLOG_COUNT_ORDER,
  backlogCounts,
  defaultBacklogFilter,
  selectBacklogTasks,
  TBacklogCounts,
} from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

/**
 * The whole arrival, as one 0→1 with four overlapping windows onto it — the
 * same structure `CalendarStep` and `HoroscopeStep` use, and for the same
 * reason: a stagger built from one driver cannot drift out of order however the
 * timings are retuned. As there, keep `last start + REVEAL_FADE` at 1 or the
 * tail of the sequence is dead time.
 *
 * The stages are the three hero lines and then the backlog, so the counts land
 * one at a time in the order they read. At the values below that is a **480ms
 * fade per stage, starting 240ms apart**. Windows overlap, so the extra stages
 * do not lengthen the sequence — `REVEAL_MS` stays where the calendar step put
 * it rather than following the horoscope's 3600, because this hero reports
 * numbers and numbers that take seconds to arrive read as an app struggling to
 * add up.
 */
const REVEAL_MS = 1200;
const REVEAL_FADE = 0.4;
/** Start of each stage's window: one per hero line, then the backlog. */
const REVEAL_STARTS = [0, 0.2, 0.4, 0.6] as const;
/** The stage the backlog itself arrives on — after all three lines. */
const DRAWER_STAGE = 3;

/**
 * The words beside each figure. The *order* the lines read in is
 * `BACKLOG_COUNT_ORDER`, not this — it is the same decision as the order
 * `defaultBacklogFilter` picks the opening filter in, so it is stated once.
 */
const HERO_LABELS: Record<keyof TBacklogCounts, string> = {
  leftBehind: "left behind",
  overdue: "overdue",
  dueSoon: "due soon",
};

type THeroLineProps = {
  /** Which count this line states — also its `HERO_LABELS` key and testID. */
  countKey: keyof TBacklogCounts;
  count: number;
  /** The figure's ink; the words beside it stay in `colors.text`. */
  color: string;
  /** This line's index into `REVEAL_STARTS`. */
  stage: number;
  reveal: SharedValue<number>;
  /** The figure column's shared width — see `BacklogStep`'s measurement. */
  figureWidth: number;
  onFigureLayout: (event: LayoutChangeEvent) => void;
};

/**
 * One line of the hero: a right-aligned figure, then the words.
 *
 * Its own component because each line fades in on its own stage and hooks
 * cannot be called from a `.map()`. The row is one accessibility node with the
 * whole phrase as its label, so splitting the sentence into two `Text`s for the
 * column alignment doesn't make a screen reader read a bare number and then an
 * orphaned fragment.
 */
function HeroLine({
  countKey,
  count,
  color,
  stage,
  reveal,
  figureWidth,
  onFigureLayout,
}: THeroLineProps) {
  const theme = useTheme();

  // Resolved out here rather than indexed inside the worklet, the way
  // `HoroscopeStep` resolves its fade distance: only numbers are captured.
  const from = REVEAL_STARTS[stage];
  const to = from + REVEAL_FADE;
  const lineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [from, to], [0, 1], Extrapolation.CLAMP),
  }));

  const words = `${count === 1 ? "task" : "tasks"} ${HERO_LABELS[countKey]}`;

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${count} ${words}`}
      style={[styles.heroLine, { gap: theme.space.xs }, lineStyle]}
    >
      <Text
        onLayout={onFigureLayout}
        style={[
          styles.figure,
          theme.fonts.heading,
          { color, minWidth: figureWidth },
        ]}
        testID={`backlog-count-${countKey}`}
      >
        {count}
      </Text>
      <Text style={[theme.fonts.heading, { color: theme.colors.text }]}>
        {words}
      </Text>
    </Animated.View>
  );
}

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
    <TaskDrawer
      date={date}
      filterId={filterId}
      onFilterChange={setFilterId}
      // The step walks the reader down a short list of what is slipping; it is
      // not where you go to hunt for a task you already have in mind, and the
      // field cost the hero a line of height for it (DEX-141).
      showSearch={false}
    />
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

  const drawerFrom = REVEAL_STARTS[DRAWER_STAGE];
  const drawerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      reveal.value,
      [drawerFrom, drawerFrom + REVEAL_FADE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // One width for every figure, so the words all start on the same vertical
  // line however many digits each count runs to. Measured rather than guessed
  // at from the font size: the widest figure reports a width larger than the
  // current one and raises it, and every narrower figure then measures exactly
  // that `minWidth` and reports no change — so this converges in one extra
  // layout pass and cannot oscillate. Monotonic on purpose; a count dropping
  // from three digits to one leaves the column a little wide rather than
  // re-flowing the hero out from under the reader.
  const [figureWidth, setFigureWidth] = useState(0);
  const onFigureLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setFigureWidth((current) => (width > current ? width : current));
  }, []);

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
  // lines, laid out and staggered identically, rather than separate copy — a
  // zero on every line is already the good news, and a state change that also
  // re-shaped the text would read as a different screen.
  const heroLines = BACKLOG_COUNT_ORDER.map((key, stage) => (
    <HeroLine
      key={key}
      count={counts[key]}
      countKey={key}
      color={figureColor(key, counts[key])}
      figureWidth={figureWidth}
      onFigureLayout={onFigureLayout}
      reveal={reveal}
      stage={stage}
    />
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
      <View
        style={[
          styles.allClear,
          {
            padding: theme.space.lg,
            // The host SafeAreaView omits the bottom edge (the tab bar owns
            // it), so centering in the full box would sit this visibly low —
            // the same reservation `EmptyScreen` and the calendar step's
            // clear-day block make.
            paddingBottom: theme.space.lg + insets.bottom,
          },
        ]}
        testID="backlog-step-clear"
      >
        <View style={{ gap: theme.space.xs }}>{heroLines}</View>
      </View>
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
      {/* Two views, not one: the outer centers the block in the page while the
          inner shrinks to the widest line, which is what lets the rows stretch
          to a common width and the words start on one vertical line. Centering
          the rows themselves instead would re-centre each line on its own
          length and there would be no line to speak of. */}
      <View style={styles.heroBlock}>
        <View style={{ gap: theme.space.xs }}>{heroLines}</View>
      </View>
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
  // Centers the block horizontally; the block itself shrinks to its widest
  // line. Shared with `allClear`, which adds the vertical centering.
  heroBlock: { alignItems: "center" },
  allClear: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  // Figure then words. The rows stretch to the block's width by default, so
  // with `figure`'s shared `minWidth` every line's words begin at the same x.
  heroLine: {
    alignItems: "baseline",
    flexDirection: "row",
  },
  // Right-aligned against that shared width, so a two-digit count grows to the
  // left and the words stay put.
  figure: { textAlign: "right" },
});
