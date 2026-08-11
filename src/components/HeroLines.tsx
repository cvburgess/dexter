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
 * The arrival shared by the ritual's reporting steps — Calendar (DEX-140) and
 * Backlog (DEX-141) — as one 0→1 with four overlapping windows onto it. The
 * same structure `HoroscopeStep` uses, and for the same reason: a stagger built
 * from one driver cannot drift out of order however the timings are retuned.
 * Keep `last start + REVEAL_FADE` at 1, or the tail of the sequence is dead
 * time.
 *
 * The stages are three hero lines and then the body beneath them, so the
 * figures land one at a time in the order they read. At the values below that
 * is a **1008ms fade per stage, starting 864ms apart**.
 *
 * **Those two numbers trade against each other, which is why retuning one means
 * touching `REVEAL_MS` too.** The invariant above fixes `3 × spacing + fade` at
 * 1, so widening the gap at a fixed total can only come out of the fade — and
 * past a spacing of `0.25` the windows stop overlapping altogether. Both passes
 * that asked for more air between the lines therefore lengthened the whole
 * sequence rather than just spreading the starts: 1200ms, then 2400, now 3600.
 *
 * That last figure matches the horoscope's total, though the shape is not the
 * same — four stages here against three, so this still moves faster per stage.
 * The overlap is now slight (144ms) where it began generous. Deliberate: the
 * horoscope is producing a reading and wants one gathering movement, where
 * three figures being counted off read better arriving as three distinct
 * events.
 */
const REVEAL_MS = 3600;
const REVEAL_FADE = 0.28;
/** Start of each stage's window: one per hero line, then the body. */
const REVEAL_STARTS = [0, 0.24, 0.48, 0.72] as const;
/** The stage the body arrives on — after all three lines. */
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

/** One stage's window onto a reveal, as an opacity style. */
export function useStageOpacity(reveal: SharedValue<number>, stage: number) {
  // Resolved out here rather than indexed inside the worklet, the way
  // `HoroscopeStep` resolves its fade distance: only numbers are captured.
  const from = REVEAL_STARTS[stage];
  const to = from + REVEAL_FADE;

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
  /** Up to three lines; each takes the matching `REVEAL_STARTS` stage. */
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
