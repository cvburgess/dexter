import { useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { Theme, useTheme } from "@/utils/theme";

/**
 * How deep the fade reaches from every edge — the same distance on all four,
 * which is what lets the corners round.
 *
 * A single point value rather than the per-axis percentages this started as.
 * Percentages made the hem twice as deep on the long axis as on the short one,
 * so the corner where they met could only ever be an ellipse quadrant that
 * matched neither neighbor. One distance makes every corner a quarter circle of
 * exactly that radius, and the uncovered middle a rounded rectangle.
 *
 * Derived from `controls.md` so it tracks the density tier — 80 comfortable, 64
 * compact — rather than being a literal that stays put when everything around
 * it shrinks.
 */
const fadeBand = (theme: Theme) => theme.controls.md * 2;

/**
 * The ramp, as opacity against distance in from the edge (0 at the rim, 1 at
 * the inner boundary of the band).
 *
 * A cube rather than the straight line or the single knee this had before, and
 * the reason is the *slope* at the inner end, not the shape in the middle. A
 * ramp that arrives at zero with slope still on it leaves a kink in the
 * brightness, and the eye resolves a kink into a line — a Mach band. That drew
 * a visible rectangle one band in from every edge, which is exactly the box the
 * fade exists to hide. `(1 - u)³` reaches zero *and* flattens as it gets there,
 * so there is no kink to see, while still dropping most of the page color in
 * the first third the way a knee did.
 */
const rampOpacity = (u: number) => (1 - u) ** 3;

/**
 * Where the curve is sampled. SVG interpolates linearly between stops, so these
 * are the resolution of the cube — closer together near the rim, where it bends
 * hardest.
 */
const RAMP_STOPS = [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1];

const EDGES = ["top", "bottom", "left", "right"] as const;
const CORNERS = ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const;

/** `Defs` ids share one namespace per document on web, so these must be unique. */
const gradientId = (part: string) => `horoscope-fade-${part}`;

/** Which way each edge's ramp runs: from the panel edge, inward. */
const EDGE_DIRECTION: Record<
  (typeof EDGES)[number],
  { x1: string; y1: string; x2: string; y2: string }
> = {
  top: { x1: "0", y1: "0", x2: "0", y2: "1" },
  bottom: { x1: "0", y1: "1", x2: "0", y2: "0" },
  left: { x1: "0", y1: "0", x2: "1", y2: "0" },
  right: { x1: "1", y1: "0", x2: "0", y2: "0" },
};

/**
 * Where each corner's ramp starts, in its own square's coordinates — the inner
 * corner, the one pointing at the middle of the panel.
 */
const CORNER_ORIGIN: Record<
  (typeof CORNERS)[number],
  { cx: string; cy: string }
> = {
  topLeft: { cx: "100%", cy: "100%" },
  topRight: { cx: "0%", cy: "100%" },
  bottomLeft: { cx: "100%", cy: "0%" },
  bottomRight: { cx: "0%", cy: "0%" },
};

type TEdgeFadeProps = {
  /** The color to dissolve into — the theme's `background`, i.e. the page. */
  color: string;
};

/**
 * Dissolves the Horoscope panel's edges into the page behind it (DEX-128).
 *
 * The theme's own `background`, opaque at the rim and clear one `fadeBand` in,
 * laid *over* the panel's tint and its starfield so the sky recedes with the
 * color rather than hanging in a region the color has already left. What is
 * left uncovered — the part that keeps full sentiment color — is a rounded
 * rectangle whose corner radius is the band.
 *
 * **Four edge ramps and four corner ramps, not one radial gradient.** A radial
 * fade on a rectangle can only touch the four edge midpoints at once; the
 * corners sit 1.41× further out and are therefore always past the end of the
 * ramp, fully washed, which read as an oval floating in the page. Widening the
 * ellipse could not fix it either — the untouched core is bounded by the
 * *nearest* edge, so pushing the radius out moved the ramp's start out with it
 * and the colored area came out the same size both times.
 *
 * **It measures itself rather than laying the gradients out in percentages.**
 * Percentage geometry here means object-bounding-box units, and
 * react-native-svg does not stretch a radial gradient to a non-square box — it
 * draws a circle, which is the bug that made the first radial version ignore
 * its own `rx`/`ry`. Points are unambiguous, and squaring the corner tiles is
 * what makes the one shared circular ramp correct in all four of them.
 *
 * Drawn as a static overlay rather than as the tint's own fill because the tint
 * underneath breathes: animating gradient stops means
 * `createAnimatedComponent(Stop)` and a `useAnimatedProps` per stop, where an
 * overlay lets the animated `backgroundColor` show through it unchanged.
 */
export function EdgeFade({ color }: TEdgeFadeProps) {
  const theme = useTheme();
  const [{ height, width }, setSize] = useState({ height: 0, width: 0 });

  const onLayout = (event: LayoutChangeEvent) =>
    setSize(event.nativeEvent.layout);

  // Clamped, so a panel narrower than two bands fades to a seam in the middle
  // rather than to overlapping ramps that double the page color there.
  const band = Math.min(fadeBand(theme), width / 3, height / 3);

  return (
    <View
      onLayout={onLayout}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      testID="horoscope-edge-fade"
    >
      {band > 0 ? (
        <Svg height={height} width={width}>
          <Defs>
            {EDGES.map((edge) => (
              <LinearGradient
                id={gradientId(edge)}
                key={edge}
                {...EDGE_DIRECTION[edge]}
              >
                {/* Fully opaque at the rim, so the panel meets the page at
                    exactly the page's color and the seam disappears. */}
                {RAMP_STOPS.map((u) => (
                  <Stop
                    key={u}
                    offset={u}
                    stopColor={color}
                    stopOpacity={rampOpacity(u)}
                  />
                ))}
              </LinearGradient>
            ))}
            {CORNERS.map((corner) => (
              // Measured outward from the inner corner, so the stops are the
              // edge ramp's read backwards — same distances, same curve, which
              // is what makes a corner indistinguishable from the edges it
              // joins. Beyond `r` the fill clamps opaque, and that clamped
              // region outside the quarter circle is the rounding.
              <RadialGradient
                id={gradientId(corner)}
                key={corner}
                r="100%"
                {...CORNER_ORIGIN[corner]}
              >
                {[...RAMP_STOPS].reverse().map((u) => (
                  <Stop
                    key={u}
                    offset={1 - u}
                    stopColor={color}
                    stopOpacity={rampOpacity(u)}
                  />
                ))}
              </RadialGradient>
            ))}
          </Defs>

          {/* The edge ramps stop short of the corners rather than running the
              full side, so no pixel is covered twice — an overlap would stack
              two page-colored fills and darken the corners into the squares
              this exists to round away. */}
          <Rect
            fill={`url(#${gradientId("top")})`}
            height={band}
            width={width - band * 2}
            x={band}
            y={0}
          />
          <Rect
            fill={`url(#${gradientId("bottom")})`}
            height={band}
            width={width - band * 2}
            x={band}
            y={height - band}
          />
          <Rect
            fill={`url(#${gradientId("left")})`}
            height={height - band * 2}
            width={band}
            x={0}
            y={band}
          />
          <Rect
            fill={`url(#${gradientId("right")})`}
            height={height - band * 2}
            width={band}
            x={width - band}
            y={band}
          />

          {/* Square, which is the whole point: a circular ramp is only correct
              in a square tile, and react-native-svg draws a circle whatever the
              box says. */}
          <Rect
            fill={`url(#${gradientId("topLeft")})`}
            height={band}
            width={band}
            x={0}
            y={0}
          />
          <Rect
            fill={`url(#${gradientId("topRight")})`}
            height={band}
            width={band}
            x={width - band}
            y={0}
          />
          <Rect
            fill={`url(#${gradientId("bottomLeft")})`}
            height={band}
            width={band}
            x={0}
            y={height - band}
          />
          <Rect
            fill={`url(#${gradientId("bottomRight")})`}
            height={band}
            width={band}
            x={width - band}
            y={height - band}
          />
        </Svg>
      ) : null}
    </View>
  );
}
