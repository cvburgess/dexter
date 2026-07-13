import Ionicons from "@react-native-vector-icons/ionicons";
import { forwardRef, useEffect, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, type CircleProps } from "react-native-svg";

import { useTheme, withOpacity } from "@/utils/theme";

// Animated.createAnimatedComponent injects a `collapsable` prop, an RN View
// hint with no web meaning. react-native-svg's web renderer forwards unknown
// props straight to the DOM <circle>, so React DOM warns about it there.
// Stripping it here (rather than on the raw Circle) keeps the drop scoped to
// the animated instance.
const BareCircle = forwardRef<Circle, CircleProps & { collapsable?: boolean }>(
  ({ collapsable, ...rest }, ref) => <Circle ref={ref} {...rest} />,
);
BareCircle.displayName = "BareCircle";

// SVG props can't run on the native driver, so the arc animates on the JS
// thread; a short duration keeps the fill feeling responsive to each tap.
const AnimatedCircle = Animated.createAnimatedComponent(BareCircle);
const FILL_DURATION_MS = 300;

// A larger ring than the emoji needs leaves breathing room between the ring
// and the glyph; the emoji font size stays fixed (see styles.emoji).
const SIZE = 40;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

type THabitRingProps = {
  emoji: string;
  /** 0–100; drives the arc length. Ignored when `faded`. */
  percentComplete: number;
  /** Future-date habits aren't instantiated yet: render dimmed and inert. */
  faded?: boolean;
  accessibilityLabel: string;
  onPress?: () => void;
};

/**
 * A 32×32 emoji inside a radial-progress ring. The track is a faint full
 * circle; the arc fills clockwise from the top as `percentComplete` grows.
 * Pinned to a fixed size (like StatusButton) so it never shifts the day layout.
 */
export function HabitRing({
  emoji,
  percentComplete,
  faded = false,
  accessibilityLabel,
  onPress,
}: THabitRingProps) {
  const theme = useTheme();

  const clamped = Math.max(0, Math.min(100, percentComplete || 0));
  const dashoffset = CIRCUMFERENCE * (1 - clamped / 100);
  const isComplete = !faded && clamped >= 100;

  // Animate the arc toward its new length on each change so a tap glides to the
  // next step instead of jumping. Seeded at the current offset so a ring that
  // mounts already-partway-done doesn't sweep in on first render.
  const [arc] = useState(() => new Animated.Value(dashoffset));
  useEffect(() => {
    Animated.timing(arc, {
      toValue: dashoffset,
      duration: FILL_DURATION_MS,
      useNativeDriver: false,
    }).start();
  }, [arc, dashoffset]);

  // Cross-fade the completed state (solid fill + checkmark) in and out so
  // finishing the last step doesn't pop. Opacity supports the native driver.
  const [complete] = useState(() => new Animated.Value(isComplete ? 1 : 0));
  useEffect(() => {
    Animated.timing(complete, {
      toValue: isComplete ? 1 : 0,
      duration: FILL_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [complete, isComplete]);
  const emojiOpacity = complete.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const ring = (
    <View style={[styles.container, faded && styles.faded]}>
      {/* Rotate the whole SVG with a plain RN transform so the arc appears to
          start at 12 o'clock. react-native-svg's own rotation/transform props
          throw on web, so this stays off the SVG element itself. */}
      <View style={styles.svgRotate}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={withOpacity(theme.colors.text, 0.15)}
            strokeWidth={STROKE}
          />
          {/* Always mounted (even at 0%, where it's fully offset and hidden)
              so the very first step animates in rather than popping. */}
          {!faded && (
            <AnimatedCircle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={theme.colors.primary}
              strokeWidth={STROKE}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={arc}
              strokeLinecap="round"
            />
          )}
        </Svg>
      </View>

      {/* Solid primary disc that fades in over the full ring when complete. */}
      {!faded && (
        <Animated.View
          style={[styles.fill, { opacity: complete }]}
          pointerEvents="none"
        >
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={SIZE / 2}
              fill={theme.colors.primary}
            />
          </Svg>
        </Animated.View>
      )}

      {/* Emoji and checkmark stack and cross-fade; clipped so a wide glyph
          can't bleed past the ring. */}
      <View style={styles.emojiWrap} pointerEvents="none">
        <Animated.View style={[styles.glyph, { opacity: emojiOpacity }]}>
          <Text style={styles.emoji} numberOfLines={1}>
            {emoji}
          </Text>
        </Animated.View>
        {!faded && (
          <Animated.View style={[styles.glyph, { opacity: complete }]}>
            <Ionicons
              color={theme.colors.primaryContent}
              name="checkmark"
              size={22}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );

  if (!onPress) return ring;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.5}
      onPress={onPress}
    >
      {ring}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: SIZE,
    width: SIZE,
  },
  emoji: {
    fontSize: 14,
    textAlign: "center",
  },
  emojiWrap: {
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
  faded: {
    opacity: 0.25,
  },
  fill: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  glyph: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  svgRotate: {
    transform: [{ rotate: "-90deg" }],
  },
});
