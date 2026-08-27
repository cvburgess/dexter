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

// Cheap to raise — one-off rasterization, since only layer opacity animates.
// STAR_LAYERS is the number that costs something and stays put.
const STAR_COUNT = 320;
const STAR_LAYERS = 4;
/** Any fixed value; it exists only to make the sky the same one every launch. */
const STAR_SEED = 128;

// Deliberately not multiples of each other — layers on 2s/4s/6s re-align and
// the sky pulses in unison; these share no common factor.
const TWINKLE_MS = [2300, 3100, 4300, 5900];

/** How far a layer dims at the bottom of its cycle. */
const TWINKLE_FLOOR = 0.35;

const FIELD = buildStarField(STAR_COUNT, STAR_LAYERS, STAR_SEED);

type TStarFieldProps = {
  /** The stars' fill — the panel supplies its theme's ink. */
  color: string;
};

// One layer per group, not per star — 72 shared values would each drive a
// worklet where four do the same job. See starField.ts for grouping/seeding.
export function StarField({ color }: TStarFieldProps) {
  return (
    <>
      {FIELD.map((stars, layer) => (
        <TwinkleLayer
          color={color}
          durationMs={TWINKLE_MS[layer]}
          key={layer}
          // Staggered so layers don't all start at full brightness and flash once.
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
      // Plain write cancels the running animation; full brightness reads as a
      // still sky rather than a dim one.
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

  // Opacity animates on the View, not per-Circle — one style on the wrapper
  // covers the whole group and stays on the platform's fast path.
  const style = useAnimatedStyle(() => ({ opacity: twinkle.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
    >
      <Svg height="100%" width="100%">
        {stars.map((star, i) => (
          <Circle
            // Percentages so the field spreads to any panel size; r stays absolute.
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
