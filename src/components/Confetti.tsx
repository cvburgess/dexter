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

/**
 * Fixed, so the burst is the same one every time it plays. Nothing depends on
 * *which* field it is; what matters is that it doesn't change under a re-render
 * (see `buildConfetti`).
 */
const CONFETTI_SEED = 146;

/** The share of the sequence one piece spends falling, once its delay is paid. */
const FALL_SPAN = 1 - CONFETTI_STAGGER;

/**
 * The palette, resolved per theme.
 *
 * **The opposite call from `SunriseBackground`'s fixed warm hexes**, and
 * deliberately: a sunrise rendered in the user's palette would be a green one on
 * this theme and a blue one on another, which is not a sunrise — where confetti
 * has no true color, so taking the palette is what makes it read as this app
 * celebrating rather than as a stock effect dropped on top.
 *
 * The three priority accents are the full-strength ones (`priority`, not
 * `priorityMuted`). `UNPRIORITIZED` and `NEITHER` are deliberately left out:
 * the first is the app's ink and the second this theme's `base-100`, so they'd
 * throw paper the color of the text and of the background behind it.
 */
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

/**
 * A tuple rather than `string[]`, so `TINT_COUNT` below cannot drift from the
 * palette it counts — the field is dealt against that number at module load,
 * before any theme exists to measure.
 */
type TTints = [string, string, string, string, string];
const TINT_COUNT = 5;

/**
 * Dealt once at module load, not per render: every argument is a constant, and
 * the all-clear re-renders under the burst whenever a task arrives from another
 * device. `buildConfetti` is deterministic, so this is the same field the step
 * would have built anyway — it just isn't rebuilt thirty times on the way down.
 */
const PIECES = buildConfetti(PIECE_COUNT, TINT_COUNT, CONFETTI_SEED);

type TConfettiPieceProps = {
  piece: TConfettiPiece;
  color: string;
  fall: SharedValue<number>;
  width: number;
  height: number;
};

/**
 * One piece, on its own layer.
 *
 * **Not grouped into shared layers the way `StarField` deals its stars.** That
 * grouping buys a sky one animation per layer instead of one per star, and it is
 * worth it there because the twinkle never stops; this runs once and then holds
 * still, and every piece needs its own fall, drift and spin anyway — sharing a
 * driver between two of them would land them in lockstep, which is the one thing
 * a burst must not do. All four animated properties are compositor properties.
 */
function ConfettiPiece({
  piece,
  color,
  fall,
  width,
  height,
}: TConfettiPieceProps) {
  const style = useAnimatedStyle(() => {
    // The piece's own 0→1, resolved once so the fall, the drift, the spin and
    // the fade cannot come apart.
    const progress = interpolate(
      fall.value,
      [piece.delay, piece.delay + FALL_SPAN],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      // In from just above the top edge and out past the bottom, so no piece is
      // ever seen arriving or stopping.
      transform: [
        { translateY: interpolate(progress, [0, 1], [-piece.size, height]) },
        { translateX: piece.drift * width * progress },
        { rotate: `${piece.turns * progress * 360}deg` },
      ],
      // Snapped on and faded off: paper thrown into frame is simply there,
      // where the tail wants to thin out rather than have the last row vanish
      // together at the bottom edge.
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
  /**
   * Replays the burst when it changes — the ritual's day, the same key
   * `useHeroReveal` and `SunriseBackground` take. Its host mounts this only once
   * the count it is celebrating has actually resolved, so this never fires
   * against a cold cache.
   */
  revealKey: string;
};

/**
 * A one-shot burst of confetti, filling whatever it is placed in.
 *
 * **Renders nothing at all under reduced motion**, rather than settling to a
 * finished state the way the reveals around it do. Their end state is the
 * content, so arriving at it instantly is the right answer; this one's is a pile
 * of paper hanging in mid-air, which reads as a rendering bug rather than as a
 * celebration. There is nothing here but the animation, so there is nothing to
 * keep.
 */
export function Confetti({ revealKey }: TConfettiProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const fall = useSharedValue(0);
  // Measured rather than taken from `useWindowDimensions`: on a large screen
  // `SwipeablePage` caps the step's column, so the window is wider than the box
  // this fills and half the field would fall outside it.
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
      // Linear, because the curve the eye reads is the stagger of the pieces'
      // windows rather than the easing of the driver behind them — the same
      // reason `SunriseBackground` and `useHeroReveal` stay linear. Gravity, if
      // it is ever wanted, belongs on the piece's own `translateY`.
      easing: Easing.linear,
    });
  }, [ready, fall, revealKey]);

  if (reduceMotion) return null;

  const tints = tintsFor(theme.colors);

  return (
    <Animated.View
      // `none`, or the filled overlay would swallow presses meant for whatever
      // it is celebrating.
      pointerEvents="none"
      onLayout={onLayout}
      // Clipped to its own box: the pieces are absolutely positioned and drift
      // sideways as they fall, and React Native does not clip overflow by
      // default — without this, paper leaves the step and paints over the tab
      // bar and the toolbar above it.
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
