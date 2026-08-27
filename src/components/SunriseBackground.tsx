import { useEffect, useState } from "react";
import { type LayoutChangeEvent, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
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

// Outermost first (paint order), but arrive innermost-first (see `stage`) so
// the glow sweeps up. Fixed warm colors — a sunrise must not take the user's palette.
const BANDS = [
  { key: "outer", radius: 1.0, color: "#F97316", opacity: 0.1 },
  { key: "mid", radius: 0.82, color: "#FB923C", opacity: 0.12 },
  { key: "inner", radius: 0.64, color: "#FBBF24", opacity: 0.14 },
  { key: "halo", radius: 0.46, color: "#FCD34D", opacity: 0.16 },
  { key: "sun", radius: 0.3, color: "#FDE68A", opacity: 0.2 },
] as const;

// One driver, [from, to] window per band, uneven and overlapping ~2/3.
// Exported so the step can wait for the sky to settle — see SummaryStep.
export const SUNRISE_MS = 2200;
const BAND_WINDOWS = [
  [0, 0.22],
  [0.14, 0.47],
  [0.28, 0.61],
  [0.42, 0.75],
  [0.56, 1],
] as const;

/** Where the sun sits, as a fraction of the step's height — just off the bottom. */
const SUN_CENTER_Y = 0.98;

/** How far each band travels up as it arrives, as a fraction of height. */
const RISE_DISTANCE = 0.18;

type TSunriseBandProps = {
  band: (typeof BANDS)[number];
  /** This band's index into `BAND_WINDOWS` — its place in the arrival order. */
  stage: number;
  rise: SharedValue<number>;
  width: number;
  height: number;
};

// One layer per band, not one shared Svg — opacity/transform stay compositor
// properties where animating r/cy would re-rasterize every frame (see StarField).
function SunriseBand({ band, stage, rise, width, height }: TSunriseBandProps) {
  const [from, to] = BAND_WINDOWS[stage];

  const style = useAnimatedStyle(() => {
    // Resolved once, used for both properties, so fade and travel can't split.
    const arrived = interpolate(
      rise.value,
      [from, to],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: arrived,
      transform: [
        {
          translateY: interpolate(arrived, [0, 1], [height * RISE_DISTANCE, 0]),
        },
      ],
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg height={height} width={width}>
        <Circle
          cx={width / 2}
          cy={height * SUN_CENTER_Y}
          fill={band.color}
          fillOpacity={band.opacity}
          r={Math.max(width, height) * band.radius}
        />
      </Svg>
    </Animated.View>
  );
}

type TSunriseBackgroundProps = {
  /** Same key useHeroReveal takes — the day. Not nullable: the step is null
   * while loading, so this never mounts against data that isn't there yet. */
  revealKey: string;
};

// Concentric arcs behind Summary's figures. Starts on measure; the step's
// content waits for SUNRISE_MS so the two don't compete for the same time.
export function SunriseBackground({ revealKey }: TSunriseBackgroundProps) {
  const reduceMotion = useReducedMotion();
  const rise = useSharedValue(0);
  // Measured, not useWindowDimensions — SwipeablePage caps the column width on
  // large screens, so the window is wider than the box this fills.
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    );
  };

  const ready = size.height > 0;

  // Same shape useHeroReveal uses — assigned, not skipped, under reduced
  // motion, so a mid-flight rise cancels if the setting flips mid-step.
  useEffect(() => {
    if (!ready) {
      rise.value = 0;
      return;
    }
    if (reduceMotion) {
      rise.value = 1;
      return;
    }
    rise.value = 0;
    rise.value = withTiming(1, {
      duration: SUNRISE_MS,
      // Linear — the eye reads the bands' window overlap, not the driver's
      // curve; easing this would bunch all five arrivals together.
      easing: Easing.linear,
    });
  }, [ready, reduceMotion, rise, revealKey]);

  return (
    <Animated.View
      // `none`, or the filled overlay would swallow the button's presses.
      pointerEvents="none"
      onLayout={onLayout}
      style={StyleSheet.absoluteFill}
      testID="sunrise-background"
    >
      {size.width > 0
        ? BANDS.map((band, index) => (
            <SunriseBand
              key={band.key}
              band={band}
              height={size.height}
              rise={rise}
              // Mirrored, not index — paint order is outermost-first, but
              // light travels the other way, sun outward.
              stage={BANDS.length - 1 - index}
              width={size.width}
            />
          ))
        : null}
    </Animated.View>
  );
}
