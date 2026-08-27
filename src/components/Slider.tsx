import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { useTheme, withOpacity } from "@/utils/theme";

// Exported and pure, like getSwipeCommitDirection — the gesture around it only
// runs on a device, so this arithmetic is tested on its own.
export function valueAtPosition(
  x: number,
  trackWidth: number,
  { min, max, step }: { min: number; max: number; step: number },
): number {
  // An unmeasured track divides to NaN, which would sail into onValueChange.
  if (trackWidth <= 0) return min;
  const ratio = Math.min(1, Math.max(0, x / trackWidth));
  const steps = Math.round((ratio * (max - min)) / step);
  // Clamped as well as snapped — a step that doesn't divide the range evenly
  // rounds the last position past the end (min 1, max 10, step 2 → 11).
  return Math.min(max, Math.max(min, min + steps * step));
}

type TSliderProps = {
  value: number;
  min: number;
  max: number;
  /** The granularity the thumb snaps to. */
  step: number;
  /** Fired every step crossed, not just on settle — fine for local state,
   * but a persisting call site needs a dropdown instead (see breath count). */
  onValueChange: (value: number) => void;
  /** Named for a screen reader, which reads the value from the role. */
  accessibilityLabel: string;
  /** The filled track and the thumb. Defaults to the theme's primary. */
  tint?: string;
  /** The unfilled track. Defaults to a muted wash of `tint`. */
  trackTint?: string;
  testID?: string;
};

// Hand-rolled, not @expo/ui's (DEX-164) — its web build hardcodes blue/grey.
// No Reanimated — a small integer re-renders rarely enough for plain layout.
export function Slider({
  value,
  min,
  max,
  step,
  onValueChange,
  accessibilityLabel,
  tint,
  trackTint,
  testID,
}: TSliderProps) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const fillColor = tint ?? theme.colors.primary;
  const restColor = trackTint ?? withOpacity(fillColor, 0.25);

  const onLayout = (event: LayoutChangeEvent) =>
    setTrackWidth(event.nativeEvent.layout.width);

  const commit = (next: number) => {
    if (next !== value) onValueChange(next);
  };

  const at = (x: number) => {
    const next = valueAtPosition(x, trackWidth, { min, max, step });
    commit(next);
    return next;
  };

  // Two gestures, not one pan accepting taps — a pan loose enough to fire on a
  // stationary touch also fires on a scroll that started on the track.
  const tap = Gesture.Tap()
    .onEnd((event, success) => {
      if (success) at(event.x);
    })
    .runOnJS(true);

  const pan = Gesture.Pan()
    // 5px claims a horizontal drag before SwipeablePage's 20px page swipe can;
    // failing on vertical keeps a hosting scroller's own gesture intact.
    .activeOffsetX([-5, 5])
    .failOffsetY([-10, 10])
    .onStart((event) => at(event.x))
    .onChange((event) => at(event.x))
    // onEnd, not onFinalize — the latter also fires for a pan that never
    // activated, which would read a position the user only passed over.
    .onEnd((event, success) => {
      if (success) at(event.x);
    })
    .runOnJS(true);

  const gesture = Gesture.Race(tap, pan);

  // Clamped, not trusted — an out-of-range stored value would push the thumb
  // off the track; resolvers narrowing that live at the data layer, not here.
  const ratio =
    max === min ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)));
  const thumbSize = theme.icons.md;
  const thumbLeft = ratio * trackWidth - thumbSize / 2;

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="adjustable"
        accessibilityValue={{ max, min, now: value }}
        onAccessibilityAction={(event) => {
          const by =
            event.nativeEvent.actionName === "increment" ? step : -step;
          // Clamped here, not valueAtPosition — an action has no position at all.
          commit(Math.min(max, Math.max(min, value + by)));
        }}
        onLayout={onLayout}
        style={[styles.root, { height: theme.controls.md }]}
        testID={testID}
      >
        <View
          style={[
            styles.trackRest,
            {
              backgroundColor: restColor,
              borderRadius: theme.radii.full,
              height: theme.space.xs,
            },
          ]}
        />
        <View
          style={[
            styles.trackFill,
            {
              backgroundColor: fillColor,
              borderRadius: theme.radii.full,
              height: theme.space.xs,
              width: ratio * trackWidth,
            },
          ]}
        />
        <View
          style={[
            styles.thumb,
            {
              backgroundColor: fillColor,
              borderRadius: theme.radii.full,
              height: thumbSize,
              left: thumbLeft,
              width: thumbSize,
            },
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    justifyContent: "center",
    position: "relative",
    width: "100%",
  },
  trackRest: {
    left: 0,
    position: "absolute",
    right: 0,
  },
  // Anchors left only — right: 0 as well would compete with the inline width.
  trackFill: {
    left: 0,
    position: "absolute",
  },
  thumb: {
    position: "absolute",
  },
});
