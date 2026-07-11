import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useTheme, withOpacity } from "@/utils/theme";

const SIZE = 32;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

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

  const clamped = Math.max(0, Math.min(100, percentComplete));
  const dashoffset = CIRCUMFERENCE * (1 - clamped / 100);

  const ring = (
    <View style={[styles.container, faded && styles.faded]}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={withOpacity(theme.colors.text, 0.15)}
          strokeWidth={STROKE}
        />
        {!faded && clamped > 0 && (
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            // Start the arc at 12 o'clock instead of 3 o'clock.
            originX={SIZE / 2}
            originY={SIZE / 2}
            rotation={-90}
          />
        )}
      </Svg>
      <Text style={styles.emoji}>{emoji}</Text>
    </View>
  );

  if (!onPress) return ring;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      {ring}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    height: SIZE,
    justifyContent: "center",
    width: SIZE,
  },
  emoji: {
    bottom: 0,
    fontSize: 14,
    left: 0,
    lineHeight: SIZE,
    position: "absolute",
    right: 0,
    textAlign: "center",
    top: 0,
  },
  faded: {
    opacity: 0.25,
  },
});
