import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { useTheme, withOpacity } from "@/utils/theme";

/**
 * Where along the track a position falls, as the value it stands for.
 *
 * Exported and pure for the reason `getSwipeCommitDirection` is: the gesture
 * around it can only be exercised on a device, so the arithmetic it depends on
 * is tested on its own. Snapping happens here rather than at the call site so
 * the thumb can never come to rest between two steps.
 */
export function valueAtPosition(
  x: number,
  trackWidth: number,
  { min, max, step }: { min: number; max: number; step: number },
): number {
  // A track that hasn't been measured yet has no position to read; anything
  // divided by it would be `NaN`, which would sail into `onValueChange` and out
  // to a preference.
  if (trackWidth <= 0) return min;
  const ratio = Math.min(1, Math.max(0, x / trackWidth));
  const steps = Math.round((ratio * (max - min)) / step);
  return min + steps * step;
}

type TSliderProps = {
  value: number;
  min: number;
  max: number;
  /** The granularity the thumb snaps to. */
  step: number;
  onValueChange: (value: number) => void;
  /** Named for a screen reader, which reads the value from the role. */
  accessibilityLabel: string;
  /** The filled track and the thumb. Defaults to the theme's primary. */
  tint?: string;
  /** The unfilled track. Defaults to a muted wash of `tint`. */
  trackTint?: string;
  testID?: string;
};

/**
 * A themed value slider.
 *
 * Hand-rolled rather than `@expo/ui`'s (DEX-164), which is the app's usual
 * source for a platform control: its web build hardcodes its own blue and grey
 * for the track, fill and thumb with no lever to change them, and this one's
 * first call site is the Breathe step, where every stroke on screen is drawn in
 * a theme color. A slider that stayed blue on a lime palette was the whole
 * problem.
 *
 * **No Reanimated here, deliberately.** The value is a small integer that
 * re-renders at most a handful of times across a drag, so the thumb is
 * positioned by ordinary layout — a shared value would buy nothing but a second
 * copy of the position to keep in step with the prop.
 *
 * `minDistance(0)` is load-bearing where this is used inside the Ritual pager:
 * `SwipeablePage`'s swipe activates at 20px of horizontal travel, and gesture
 * handler cancels an ancestor once a descendant activates, so grabbing on touch
 * is what stops a drag along the track from paging the ritual instead.
 */
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

  const pan = Gesture.Pan()
    .minDistance(0)
    // Both handlers do the same thing: `onBegin` makes a tap anywhere on the
    // track move the thumb there, and `onChange` carries the drag after it.
    .onBegin((event) => {
      commit(valueAtPosition(event.x, trackWidth, { min, max, step }));
    })
    .onChange((event) => {
      commit(valueAtPosition(event.x, trackWidth, { min, max, step }));
    })
    .runOnJS(true);

  // Clamped rather than trusted: a stored value outside the range would push
  // the thumb off the end of the track, and the resolvers that narrow those
  // live at the data layer, not here.
  const ratio =
    max === min ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)));
  const thumbSize = theme.icons.md;
  // The thumb's center travels the track; its box is offset by its own radius
  // so it sits *on* each end rather than hanging past them.
  const thumbLeft = ratio * trackWidth - thumbSize / 2;

  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityActions={[
          { name: "increment" },
          { name: "decrement" },
        ]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="adjustable"
        accessibilityValue={{ max, min, now: value }}
        onAccessibilityAction={(event) => {
          const by = event.nativeEvent.actionName === "increment" ? step : -step;
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
  // The row is taller than the track it draws, so the whole of it is a tap
  // target rather than the 4px line.
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
  // Width is set inline from the value, so this one anchors left only — giving
  // it `right: 0` as well would leave the two competing for the same box.
  trackFill: {
    left: 0,
    position: "absolute",
  },
  thumb: {
    position: "absolute",
  },
});
