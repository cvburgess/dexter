import { useState } from "react";
import {
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { Icon } from "@/components/Icon";
import { type Theme, useTheme } from "@/utils/theme";

// Lifted from HoroscopeStep (DEX-128) for PreviewTomorrowStep (DEX-149). A
// host reads scroll offset off the scroller and keeps blocks flat — see RevealOnScroll.

const SCROLL_HINT_ICON = {
  sf: "chevron.down",
  ionicon: "chevron-down",
} as const;

// Four tap targets of travel — long enough that the chevron dims with the
// scroll rather than blinking out on the first flick.
const scrollHintFade = (theme: Theme) => theme.controls.md * 4;

// Fractions read against each block's own top, not an absolute scroll offset
// — ENTER is under 1 so a block doesn't fade the instant it crosses the fold.
const REVEAL_ENTER = 0.95;
const REVEAL_EXIT = 0.55;

type TArrival = {
  /** The step's reveal driver, 0→1. */
  reveal: SharedValue<number>;
  /** Start of this element's window onto that driver, as a fraction of it. */
  revealFrom: number;
  /** End of it. */
  revealTo: number;
  /** The scroller's offset, read straight off it by the host. */
  scrollOffset: SharedValue<number>;
};

// The chevron at the fold — absolutely positioned full-width so it centers
// without shifting content; brings its own `bottom` for both callers.
export function ScrollHint({
  color,
  reveal,
  revealFrom,
  revealTo,
  scrollOffset,
}: TArrival & { color: string }) {
  const theme = useTheme();

  // Resolved out here — useAnimatedStyle runs on the UI runtime, where a
  // module function is a remote reference and calling it throws.
  const fadeDistance = scrollHintFade(theme);

  // Multiplied, not one winning — a reader scrolling during arrival should
  // see both fades at once rather than pop to full strength.
  const hintStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(
        reveal.value,
        [revealFrom, revealTo],
        [0, 1],
        Extrapolation.CLAMP,
      ) *
      interpolate(
        scrollOffset.value,
        [0, fadeDistance],
        [1, 0],
        Extrapolation.CLAMP,
      ),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.scrollHint, { bottom: theme.space.lg }, hintStyle]}
      testID="scroll-hint"
    >
      <Icon {...SCROLL_HINT_ICON} color={color} />
    </Animated.View>
  );
}

// A component, not an inline style — these render from .map(). Must be a flat
// direct child (marginTop, not a wrapper gap) or onLayout's y is wrong.
export function RevealOnScroll({
  children,
  maxScroll,
  reveal,
  revealFrom,
  revealTo,
  scrollOffset,
  style,
  viewportHeight,
}: TArrival & {
  children: React.ReactNode;
  /** `contentHeight - viewportHeight`, the one thing a block cannot measure. */
  maxScroll: number;
  style?: StyleProp<ViewStyle>;
  viewportHeight: number;
}) {
  const [top, setTop] = useState<number | null>(null);

  const onLayout = (event: LayoutChangeEvent) =>
    setTop(event.nativeEvent.layout.y);

  // Resolved out here, not in the worklet, which can only capture plain values.
  const measured = top !== null && viewportHeight > 0;
  const exit = measured
    ? Math.min(top - viewportHeight * REVEAL_EXIT, maxScroll)
    : 0;
  const enter = exit - viewportHeight * (REVEAL_ENTER - REVEAL_EXIT);

  const revealStyle = useAnimatedStyle(() => {
    if (!measured) return { opacity: 0 };

    return {
      opacity:
        interpolate(
          reveal.value,
          [revealFrom, revealTo],
          [0, 1],
          Extrapolation.CLAMP,
        ) *
        interpolate(
          scrollOffset.value,
          [enter, exit],
          [0, 1],
          Extrapolation.CLAMP,
        ),
    };
  });

  return (
    <Animated.View onLayout={onLayout} style={[style, revealStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrollHint: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
});
