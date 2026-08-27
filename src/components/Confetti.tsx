import { useEffect, useState } from "react";
import { type LayoutChangeEvent, StyleSheet } from "react-native";
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
import {
  buildConfetti,
  CONFETTI_STAGGER,
  TConfettiPiece,
} from "@/utils/confetti";
import { useTheme } from "@/utils/theme";

/** How long the whole burst takes, first piece leaving to last one gone. */
const CONFETTI_MS = 2600;

/** How many pieces are thrown. The cheap dial — see the note on cost below. */
const PIECE_COUNT = 28;

/** Fixed so the burst is the same every play — only that it can't change
 * under a re-render matters (see `buildConfetti`). */
const CONFETTI_SEED = 146;

/** The share of the sequence one piece spends falling, once its delay is paid. */
const FALL_SPAN = 1 - CONFETTI_STAGGER;

/** Opposite of `SunriseBackground`'s fixed hexes — confetti has no true
 * color, so the palette is what makes it read as this app celebrating. */
const tintsFor = (colors: {
  primary: string;
  success: string;
  priority: string[];
}): TTints => [
  colors.primary,
  colors.success,
  colors.priority[ETaskPriority.IMPORTANT_AND_URGENT],
  colors.priority[ETaskPriority.URGENT],
  colors.priority[ETaskPriority.IMPORTANT],
];

// A tuple, not `string[]`, so `TINT_COUNT` can't drift from what it counts —
// the field deals against it at module load, before any theme exists.
type TTints = [string, string, string, string, string];
const TINT_COUNT = 5;

// Dealt once at module load, not per render — the all-clear re-renders under
// the burst whenever a task arrives elsewhere, and this is deterministic.
const PIECES = buildConfetti(PIECE_COUNT, TINT_COUNT, CONFETTI_SEED);

type TConfettiPieceProps = {
  piece: TConfettiPiece;
  color: string;
  fall: SharedValue<number>;
  width: number;
  height: number;
};

/**
 * One piece, on its own layer — unlike `StarField`'s shared-layer stars: this
 * runs once, and sharing a driver would land pieces in lockstep, the one thing
 * a burst must not do.
 */
function ConfettiPiece({
  piece,
  color,
  fall,
  width,
  height,
}: TConfettiPieceProps) {
  const style = useAnimatedStyle(() => {
    // The piece's own 0→1, resolved once so fall/drift/spin/fade agree.
    const progress = interpolate(
      fall.value,
      [piece.delay, piece.delay + FALL_SPAN],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      // In above the top edge, out past the bottom — no piece is seen arriving
      // or stopping.
      transform: [
        { translateY: interpolate(progress, [0, 1], [-piece.size, height]) },
        { translateX: piece.drift * width * progress },
        { rotate: `${piece.turns * progress * 360}deg` },
      ],
      // Snapped on, faded off — paper is simply there, but the tail thins
      // rather than vanishing together at the bottom edge.
      opacity: interpolate(
        progress,
        [0, 0.02, 0.75, 1],
        [0, 1, 1, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          backgroundColor: color,
          height: piece.size * piece.ratio,
          left: piece.x * width,
          width: piece.size,
        },
        style,
      ]}
    />
  );
}

type TConfettiProps = {
  /** Replays the burst when it changes — same key `useHeroReveal` and
   * `SunriseBackground` take; the host mounts only once the count resolves. */
  revealKey: string;
};

/**
 * A one-shot burst, filling whatever it is placed in. **Renders nothing under
 * reduced motion** rather than settling — its end state is paper hanging in
 * mid-air, which reads as a bug, not a celebration.
 */
export function Confetti({ revealKey }: TConfettiProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const fall = useSharedValue(0);
  // Measured, not `useWindowDimensions` — SwipeablePage caps the step's
  // column on large screens, so the window is wider than the box this fills.
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    );
  };

  // Nothing to animate until the box has been measured — every piece's travel is
  // a fraction of it.
  const ready = size.height > 0;

  useEffect(() => {
    if (!ready) {
      fall.value = 0;
      return;
    }
    fall.value = 0;
    fall.value = withTiming(1, {
      duration: CONFETTI_MS,
      // Linear — the eye reads the pieces' stagger, not the driver's easing,
      // same as SunriseBackground/useHeroReveal.
      easing: Easing.linear,
    });
  }, [ready, fall, revealKey]);

  if (reduceMotion) return null;

  const tints = tintsFor(theme.colors);

  return (
    <Animated.View
      // `none`, or the overlay would swallow presses meant for what it
      // celebrates.
      pointerEvents="none"
      onLayout={onLayout}
      // RN doesn't clip overflow by default — without this, drifting pieces
      // paint over the tab bar and toolbar above.
      style={[StyleSheet.absoluteFill, styles.clip]}
      testID="confetti"
    >
      {ready
        ? PIECES.map((piece, index) => (
            <ConfettiPiece
              key={index}
              color={tints[piece.tint]}
              fall={fall}
              height={size.height}
              piece={piece}
              width={size.width}
            />
          ))
        : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  // Positioned from the top-left and moved entirely by transform, so a piece
  // never triggers layout while it falls.
  piece: {
    position: "absolute",
    top: 0,
  },
});
