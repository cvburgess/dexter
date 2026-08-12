import { useCallback, useEffect, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
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

import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { ritualStepInsetTop } from "@/utils/ritualSteps";
import { useTheme } from "@/utils/theme";

/**
 * The arrival shared by the ritual's reporting steps — Calendar (DEX-140),
 * Backlog (DEX-141), Open tasks (DEX-146) and Review (DEX-148) — as one 0→1
 * with a set of overlapping windows onto it. The same structure `HoroscopeStep`
 * uses, and for the same reason: a stagger built from one driver cannot drift
 * out of order however the timings are retuned.
 *
 * The stages are the hero lines and then the body beneath them, so the figures
 * land one at a time in the order they read: a **1008ms fade per stage,
 * starting 864ms apart**.
 *
 * **Those two figures are the tuning, and they are stated in milliseconds
 * rather than as fractions of the total.** `useStageOpacity` needs fractions,
 * but deriving them here means the invariant the sequence depends on — the last
 * window closing exactly as the driver lands, so the tail is not dead time —
 * holds by construction rather than by arithmetic someone has to redo. It is
 * what let DEX-148 add a fifth stage without moving the first four by a
 * millisecond: `REVEAL_MS` grew from 3600 to 4464, and every existing step's
 * stages still start at 0 / 864 / 1728 / 2592.
 *
 * The two numbers do still trade against each other — widening the gap at a
 * *fixed* total can only come out of the fade — which is why both passes that
 * asked for more air between the lines lengthened the whole sequence instead:
 * 1200ms, then 2400, then 3600. The overlap that leaves is slight (144ms) where
 * it began generous. Deliberate: the horoscope is producing a reading and wants
 * one gathering movement, where figures being counted off read better arriving
 * as distinct events.
 */
const STAGE_GAP_MS = 864;
const STAGE_FADE_MS = 1008;
/**
 * Four hero lines and then the body — one more stage than the four DEX-148
 * found, since its Review step counts habits, tasks, events and focus blocks
 * before it draws anything. See above for why adding it moved none of the
 * others; a sixth would work the same way.
 */
const STAGE_COUNT = 5;

const REVEAL_MS = STAGE_GAP_MS * (STAGE_COUNT - 1) + STAGE_FADE_MS;
const REVEAL_FADE = STAGE_FADE_MS / REVEAL_MS;
/** Start of each stage's window: one per hero line, then the body. */
const REVEAL_STARTS = Array.from(
  { length: STAGE_COUNT },
  (_unused, stage) => (stage * STAGE_GAP_MS) / REVEAL_MS,
);
/**
 * The stage the body arrives on **for a hero that draws exactly three lines** —
 * the Calendar and Backlog steps, which always do.
 *
 * Not "the last stage": a step whose line count varies has to stage its body at
 * `heroLines.length` instead, or the body waits for figures that were never
 * drawn. That is the trap `SummaryStep`, `OpenTasksStep` and `ReviewStep` each
 * document at their own call site.
 */
export const BODY_STAGE = 3;

/**
 * Drives one arrival. `revealKey` gates the start and replays it when it
 * changes; pass `null` while the data is still loading so the sequence waits
 * rather than running against placeholder figures.
 *
 * Key it on the *day* rather than on the fetched data: a background refetch
 * hands back a fresh array every time, and a hero must not fade out from under
 * someone re-reading it. Walking `DayNav` replays the reveal by remounting the
 * whole step (`ritualPageKey`), so the key's only job is the wait.
 */
export function useHeroReveal(revealKey: string | null): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(0);

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
      // Linear, because the curve the eye reads here is the overlap of the
      // windows rather than the easing of the driver behind them.
      easing: Easing.linear,
    });
  }, [reduceMotion, reveal, revealKey]);

  return reveal;
}

/**
 * One stage's window onto the reveal, as `[from, to]` fractions of it.
 *
 * Split out of `useStageOpacity` because it is the whole of the stage table's
 * arithmetic and the only part of this module a test can see: everything below
 * it crosses into a worklet, which the reanimated mock renders opaque (see
 * docs/testing.md). A stage past the end of `REVEAL_STARTS` returns `NaN` here
 * rather than silently interpolating over `undefined` inside the worklet, where
 * the only symptom is a body that never fades in.
 */
export const stageWindow = (stage: number): [number, number] => {
  const from = REVEAL_STARTS[stage];
  return [from, from + REVEAL_FADE];
};

/** One stage's window onto a reveal, as an opacity style. */
export function useStageOpacity(reveal: SharedValue<number>, stage: number) {
  // Resolved out here rather than indexed inside the worklet, the way
  // `HoroscopeStep` resolves its fade distance: only numbers are captured.
  const [from, to] = stageWindow(stage);

  return useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [from, to], [0, 1], Extrapolation.CLAMP),
  }));
}

export type THeroLine = {
  /** Stable key, and the suffix of the line's figure testID. */
  key: string;
  /** The figure, already formatted — a count, a duration, whatever it is. */
  figure: string;
  /** The words beside it. */
  words: string;
  /** The figure's ink; the words always stay in `colors.text`. */
  color: string;
};

type THeroLineProps = Omit<THeroLine, "key"> & {
  /**
   * The line's `key`, passed again under its own name — React reserves `key`
   * and never delivers it to the component, and the testID needs it.
   */
  lineKey: string;
  /** This line's index into `REVEAL_STARTS`. */
  stage: number;
  reveal: SharedValue<number>;
  figureWidth: number;
  onFigureLayout: (event: LayoutChangeEvent) => void;
};

function HeroLine({
  figure,
  words,
  color,
  lineKey,
  stage,
  reveal,
  figureWidth,
  onFigureLayout,
}: THeroLineProps) {
  const theme = useTheme();
  const lineStyle = useStageOpacity(reveal, stage);

  return (
    <Animated.View
      accessible
      // One node for the whole line: split across two `Text`s for the column,
      // it would otherwise be read as a bare figure and then an orphaned
      // fragment.
      accessibilityLabel={`${figure} ${words}`}
      style={[styles.line, { gap: theme.space.sm }, lineStyle]}
    >
      <Text
        onLayout={onFigureLayout}
        style={[
          styles.figure,
          theme.fonts.heading,
          { color, minWidth: figureWidth },
        ]}
        testID={`hero-figure-${lineKey}`}
      >
        {figure}
      </Text>
      <Text style={[theme.fonts.heading, { color: theme.colors.text }]}>
        {words}
      </Text>
    </Animated.View>
  );
}

type THeroLinesProps = {
  /** Up to four lines; each takes the matching `REVEAL_STARTS` stage. */
  lines: THeroLine[];
  reveal: SharedValue<number>;
  /**
   * Vertical space the body below the hero already brings itself, subtracted
   * from this block's bottom padding so the total stays symmetric. The Backlog
   * step passes `TaskDrawer`'s own padding; the Calendar step's timeline brings
   * none, so it passes nothing.
   */
  bodyInsetTop?: number;
  testID?: string;
};

/**
 * The hero a reporting ritual step opens with: a few figures, each with its
 * words, arriving one at a time.
 *
 * **Two columns, centered as a unit.** The figures are right-aligned and the
 * words left-aligned, so every line's text begins on one vertical line —
 * centering each line on its own length instead left the labels starting at as
 * many different x positions as there were lines. That takes the two nested
 * views below: the outer centers, the inner shrinks to the widest line so the
 * rows stretch to a common width.
 *
 * Carries its own vertical breathing room but no side gutter; `SwipeablePage`
 * and the ritual layouts own that (see docs/design.md, "Who owns spacing").
 */
export function HeroLines({
  lines,
  reveal,
  bodyInsetTop = 0,
  testID,
}: THeroLinesProps) {
  const theme = useTheme();

  // The ritual layout has already placed its step inset above this block, so
  // `lg` on both sides would leave the hero sitting visibly low — the space
  // over it is that inset *plus* the padding, and under it only the padding.
  // Matching the inset below evens the two out: above is `inset + lg`, below is
  // `lg + (inset - bodyInsetTop) + bodyInsetTop`, which is the same number at
  // either breakpoint. `useIsLargeDevice` is the very predicate `ritual/index`
  // picks the layout with, so this cannot disagree with the inset actually
  // applied.
  const insetAbove = ritualStepInsetTop(theme.space, useIsLargeDevice());

  // One width for every figure, so the words all start on the same vertical
  // line however many characters each figure runs to. Measured rather than
  // guessed at from the font size: the widest figure reports a width larger
  // than the current one and raises it, and every narrower figure then measures
  // exactly that `minWidth` and reports no change — so this converges in one
  // extra layout pass and cannot oscillate. Monotonic on purpose; a figure
  // shrinking leaves the column a little wide rather than re-flowing the hero
  // out from under the reader.
  const [figureWidth, setFigureWidth] = useState(0);
  const onFigureLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setFigureWidth((current) => (width > current ? width : current));
  }, []);

  return (
    <View
      style={[
        styles.block,
        {
          paddingTop: theme.space.lg,
          paddingBottom: theme.space.lg + insetAbove - bodyInsetTop,
        },
      ]}
      testID={testID}
    >
      <View style={{ gap: theme.space.xs }}>
        {lines.map((line, stage) => (
          <HeroLine
            key={line.key}
            color={line.color}
            figure={line.figure}
            figureWidth={figureWidth}
            lineKey={line.key}
            onFigureLayout={onFigureLayout}
            reveal={reveal}
            stage={stage}
            words={line.words}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Centers the block horizontally; the inner view shrinks to its widest line.
  block: { alignItems: "center" },
  // Figure then words. The rows stretch to the inner view's width by default,
  // so with `figure`'s shared `minWidth` every line's words begin at the same x.
  line: {
    alignItems: "baseline",
    flexDirection: "row",
  },
  // Right-aligned against that shared width, so a longer figure grows to the
  // left and the words stay put.
  figure: { textAlign: "right" },
});
