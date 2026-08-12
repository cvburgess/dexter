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

/**
 * The bands, outermost first — drawn in this order so each paints over the one
 * behind it and only its top arc shows, which is what makes a stack of circles
 * read as a sunrise rather than as a target.
 *
 * **They arrive in the opposite order**, innermost first (see the `stage` the
 * map below hands each one). A larger band's arc sits higher on screen, so
 * lighting them inside-out sweeps the glow up the step — the sun clears the
 * horizon and the sky catches after it. Outermost-first was tried and reads
 * backwards: the whole sky lights and the sun then appears inside a scene that
 * has already happened.
 *
 * **Fixed warm colors, not theme tokens**, for the reason `sentimentTints`
 * gives in docs/design.md: a sunrise that took the user's palette would be a
 * green one on this theme and a blue one on another, which is not a sunrise.
 * Kept at low alpha so it reads as light *behind* the step rather than as a
 * second background — every theme's own surface still shows through, so the
 * figures and the button keep their contrast without needing an ink of their
 * own the way the horoscope panel does.
 *
 * `radius` is a fraction of the larger of the two axes, so the arcs keep their
 * shape from a phone to a capped-width desktop column.
 */
const BANDS = [
  { key: "outer", radius: 1.0, color: "#F97316", opacity: 0.1 },
  { key: "mid", radius: 0.82, color: "#FB923C", opacity: 0.12 },
  { key: "inner", radius: 0.64, color: "#FBBF24", opacity: 0.14 },
  { key: "halo", radius: 0.46, color: "#FCD34D", opacity: 0.16 },
  { key: "sun", radius: 0.3, color: "#FDE68A", opacity: 0.2 },
] as const;

/**
 * One 0→1 driver with a window per band, the same structure `HeroLines` and
 * `HoroscopeStep` use — a stagger built from one value cannot drift out of
 * order however the timings are retuned.
 *
 * A `[from, to]` per band rather than shared starts and one fade, because the
 * windows are **not** all the same length: in **arrival** order (sun outward),
 * the sun takes ~480ms and the bands behind it run ~730ms. The sun is a single
 * small shape that has either risen or not, where a band is a wash across the
 * whole step and snapping it in reads as a flash. Even windows were tried first
 * and made the whole thing feel slow, because the one shape the eye is waiting
 * on moved at the pace of the largest.
 *
 * **The bands start ~310ms apart**, which is well inside each other's fades —
 * they overlap by roughly two thirds. Successive passes have pulled this in
 * from 900ms to 540 to here; what the tightening buys is one continuous
 * brightening rather than a countable sequence, and the thing it spends is the
 * legibility of the order, which is why the sun's own head start is what keeps
 * the direction readable.
 *
 * Two invariants, both easy to break while retuning: the last `to` must be 1,
 * or the tail is dead time; and each band must start before the one ahead of it
 * finishes, or the sky arrives in five separate switch-flips rather than as one
 * brightening.
 */
/**
 * Exported so the step can bring its content in *after* the sky has settled
 * without copying the number — see `SummaryStep`.
 */
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

/**
 * One band, on its own absolutely-filled layer.
 *
 * A layer each rather than one `Svg` for all five, because each has to move
 * independently — and moving a layer is `opacity` + `transform`, both
 * compositor properties, where animating the circles' own `r`/`cy` would
 * re-rasterize a screen-sized SVG every frame. The same trade `StarField`
 * makes for its four star layers.
 */
function SunriseBand({ band, stage, rise, width, height }: TSunriseBandProps) {
  const [from, to] = BAND_WINDOWS[stage];

  const style = useAnimatedStyle(() => {
    // The band's own 0→1, resolved once and used for both properties so the
    // fade and the travel cannot come apart.
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
  /**
   * Gates the rise and replays it when it changes — the day, the same key
   * `useHeroReveal` takes. `null` holds it back while the step's data is still
   * loading, so the sun doesn't come up behind figures that aren't there yet.
   */
  revealKey: string | null;
};

/**
 * The sunrise behind the ritual's Summary step: concentric arcs rising from
 * below it, one band at a time.
 *
 * It starts as soon as the step has a day and a measured box — **alongside the
 * hero, not after it.** Waiting the figures out was tried first and read as two
 * unrelated events; run together, the sun comes up as the day is being counted
 * and the outermost band settles about when the button lands.
 *
 * Deliberately not a gradient image — vector circles at a handful of fixed
 * radii stay crisp at every width, weigh nothing in the bundle, and can be
 * retuned by editing `BANDS` rather than by re-exporting art.
 */
export function SunriseBackground({ revealKey }: TSunriseBackgroundProps) {
  const reduceMotion = useReducedMotion();
  const rise = useSharedValue(0);
  // Measured rather than taken from `useWindowDimensions`: on a large screen
  // `SwipeablePage` caps the step's column at `SWIPEABLE_PAGE_MAX_WIDTH`, so the
  // window is wider than the box this fills and the sun would sit off-center.
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    );
  };

  const ready = revealKey !== null && size.height > 0;

  // The same shape `useHeroReveal` uses, for the same reasons: keyed on the day
  // so the rise replays when it changes, held at 0 until there is a day *and* a
  // measured box, and **assigned** rather than skipped under reduced motion —
  // a plain write cancels whatever is running on the value, which is what stops
  // a rise mid-flight when the setting is turned on while the step is open.
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
      // Linear, because the curve the eye reads is the overlap of the bands'
      // windows rather than the easing of the driver behind them. Easing this
      // would bend all five arrivals at once and bunch the stagger.
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
              // Mirrored, not `index`: the array is in paint order (outermost
              // first, so each covers the last) while the light travels the
              // other way, from the sun outward and so up the step.
              stage={BANDS.length - 1 - index}
              width={size.width}
            />
          ))
        : null}
    </Animated.View>
  );
}
