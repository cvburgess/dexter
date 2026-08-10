import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { buildStarField, TStar } from "@/utils/starField";

/**
 * Cheap to raise: the circles are drawn once per layer and never again, since
 * only the *layer's* opacity animates and that is a compositor property. The
 * cost is a one-off rasterization, not per-frame work, so this scales with
 * taste rather than with the frame budget. `STAR_LAYERS` is the number that
 * costs something, and it stays put.
 */
const STAR_COUNT = 320;
const STAR_LAYERS = 4;
/** Any fixed value; it exists only to make the sky the same one every launch. */
const STAR_SEED = 128;

/**
 * How long one layer takes to fade to its dimmest and back.
 *
 * Deliberately not multiples of each other. Layers on 2s/4s/6s re-align every
 * few seconds and the whole sky pulses in unison, which reads as the panel
 * flickering rather than as stars twinkling. These share no common factor, so
 * the layers drift permanently out of phase and no two are ever bright
 * together twice.
 */
const TWINKLE_MS = [2300, 3100, 4300, 5900];

/** How far a layer dims at the bottom of its cycle. */
const TWINKLE_FLOOR = 0.35;

const FIELD = buildStarField(STAR_COUNT, STAR_LAYERS, STAR_SEED);

type TStarFieldProps = {
  /** The stars' fill — the panel supplies its theme's ink. */
  color: string;
};

/**
 * The drawn night sky behind the Horoscope step (DEX-128).
 *
 * Replaced a photograph, because stars that are real elements can twinkle
 * individually where a photo could only be cross-faded whole.
 *
 * Rendered as one absolutely-filled layer per group rather than one per star:
 * 72 shared values would each drive their own worklet every frame, where four
 * do the same job for the eye. See `utils/starField.ts` for why they are
 * grouped and why the field is seeded rather than random.
 */
export function StarField({ color }: TStarFieldProps) {
  return (
    <>
      {FIELD.map((stars, layer) => (
        <TwinkleLayer
          color={color}
          durationMs={TWINKLE_MS[layer]}
          key={layer}
          // Staggered so the layers do not all start at full brightness on the
          // same frame, which would flash once on entry before the differing
          // periods pulled them apart.
          startOpacity={1 - layer * 0.12}
          stars={stars}
        />
      ))}
    </>
  );
}

function TwinkleLayer({
  color,
  durationMs,
  startOpacity,
  stars,
}: {
  color: string;
  durationMs: number;
  startOpacity: number;
  stars: TStar[];
}) {
  const reduceMotion = useReducedMotion();
  const twinkle = useSharedValue(startOpacity);

  useEffect(() => {
    if (reduceMotion) {
      // A plain write cancels the running animation, which is what stops the
      // sky when the setting is turned on while the step is on screen. Full
      // brightness, so the field reads as a still sky rather than a dim one.
      twinkle.value = 1;
      return;
    }
    twinkle.value = withRepeat(
      withTiming(TWINKLE_FLOOR, {
        duration: durationMs,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [durationMs, reduceMotion, twinkle]);

  // The layer's opacity animates on the *View*, not on the SVG nodes. An
  // animated prop on a `Circle` needs `createAnimatedComponent` and a
  // `useAnimatedProps` per node; one plain style on the wrapper does the same
  // thing for the whole group and stays on the platform's own fast path.
  const style = useAnimatedStyle(() => ({ opacity: twinkle.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
    >
      <Svg height="100%" width="100%">
        {stars.map((star, i) => (
          <Circle
            // Percentages, so the field spreads across whatever size the panel
            // is, while `r` stays absolute and the stars stay round.
            cx={`${star.x}%`}
            cy={`${star.y}%`}
            fill={color}
            key={i}
            opacity={star.opacity}
            r={star.radius}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}
