import Ionicons from "@react-native-vector-icons/ionicons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useTheme, withOpacity } from "@/utils/theme";

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

  const ring = (
    <View style={[styles.container, faded && styles.faded]}>
      {isComplete ? (
        // Done: a solid primary disc filling the ring.
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={SIZE / 2}
            fill={theme.colors.primary}
          />
        </Svg>
      ) : (
        // Rotate the whole SVG with a plain RN transform so the arc appears to
        // start at 12 o'clock. react-native-svg's own rotation/transform props
        // throw on web, so this stays off the SVG element itself.
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
            {!faded && clamped > 0 && (
              <Circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={theme.colors.primary}
                strokeWidth={STROKE}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashoffset}
                strokeLinecap="round"
              />
            )}
          </Svg>
        </View>
      )}
      {/* Upright, centered, and clipped so a wide glyph can't bleed past the ring. */}
      <View style={styles.emojiWrap} pointerEvents="none">
        {isComplete ? (
          <Ionicons
            color={theme.colors.primaryContent}
            name="checkmark"
            size={22}
          />
        ) : (
          <Text style={styles.emoji} numberOfLines={1}>
            {emoji}
          </Text>
        )}
      </View>
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
    height: SIZE,
    width: SIZE,
  },
  emoji: {
    fontSize: 14,
    textAlign: "center",
  },
  emojiWrap: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
  faded: {
    opacity: 0.25,
  },
  svgRotate: {
    transform: [{ rotate: "-90deg" }],
  },
});
