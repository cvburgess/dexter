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

// Shared arrival for the reporting steps, one 0→1 with overlapping windows.
// Stated in ms so DEX-148 added a fifth stage without moving the others' starts.
const STAGE_GAP_MS = 864;
const STAGE_FADE_MS = 1008;
const STAGE_COUNT = 5;

const REVEAL_MS = STAGE_GAP_MS * (STAGE_COUNT - 1) + STAGE_FADE_MS;
const REVEAL_FADE = STAGE_FADE_MS / REVEAL_MS;
/** Start of each stage's window: one per hero line, then the body. */
const REVEAL_STARTS = Array.from(
  { length: STAGE_COUNT },
  (_unused, stage) => (stage * STAGE_GAP_MS) / REVEAL_MS,
);
// For heroes that always draw exactly three lines. A variable count must
// stage at heroLines.length instead (see SummaryStep, OpenTasksStep, ReviewStep).
export const BODY_STAGE = 3;

// null while loading, so it waits rather than running against placeholders;
// keyed on the day so a background refetch doesn't fade the hero out.
export function useHeroReveal(revealKey: string | null): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(0);

  useEffect(() => {
    if (!revealKey) {
      reveal.value = 0;
      return;
    }
    if (reduceMotion) {
      // Assigned, not skipped: a plain write cancels whatever's running,
      // stopping a reveal mid-flight if the setting flips while on screen.
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

// Split out of useStageOpacity as the only part a test can see — everything
// below crosses into a worklet the reanimated mock renders opaque.
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
  /** Passed again under its own name — React reserves `key` and never delivers it. */
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
      // One node — split across two Texts it reads as a bare figure and an orphan.
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
  /** Space the body already brings, subtracted from bottom padding to stay symmetric. */
  bodyInsetTop?: number;
  testID?: string;
};

// Right-aligned figures, left-aligned words, so every line's text begins on
// one vertical line — two nested views: outer centers, inner shrinks to widest.
export function HeroLines({
  lines,
  reveal,
  bodyInsetTop = 0,
  testID,
}: THeroLinesProps) {
  const theme = useTheme();

  // Matches the ritual layout's own step inset above this block, or lg on
  // both sides would leave the hero sitting visibly low.
  const insetAbove = ritualStepInsetTop(theme.space, useIsLargeDevice());

  // Measured, not guessed from font size — the widest figure raises minWidth
  // and every narrower one then reports no change, converging in one pass.
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
