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

/**
 * A screenful of hero, then more of it as you scroll — the shape the Horoscope
 * step (DEX-128) invented and the Preview tomorrow step (DEX-149) asked for by
 * name. Lifted out of `HoroscopeStep` when the second surface wanted it, rather
 * than copied: the measurement rules below are the whole of why it works, and
 * every one of them is the kind of thing a second copy gets subtly wrong.
 *
 * **A host has three obligations.** Read the offset off the scroller itself
 * (`useAnimatedRef` + `useScrollViewOffset`) so neither fade touches the JS
 * thread; measure the viewport (`onLayout`) and the content
 * (`onContentSizeChange`) so `maxScroll` is known; and keep every revealed block
 * a **flat direct child** of the scroll content — see `RevealOnScroll`.
 *
 * Both parts take an arrival window as `[revealFrom, revealTo]` fractions of a
 * step's own reveal driver rather than reading a stage table of their own: the
 * two callers count their stages differently (`HoroscopeStep` has three of its
 * own, `PreviewTomorrowStep` takes `stageWindow` from `HeroLines`), and a shared
 * constant here would have to be wrong for one of them.
 */

const SCROLL_HINT_ICON = {
  sf: "chevron.down",
  ionicon: "chevron-down",
} as const;

/**
 * How far the reader has to scroll before the chevron is fully gone.
 *
 * Four tap targets' worth of travel — roughly a quarter of a phone's hero. Long
 * enough that the chevron dims *with* the scroll rather than blinking out on
 * the first flick, which is what a shorter distance gave: a fade that resolves
 * inside one gesture is indistinguishable from a toggle.
 */
const scrollHintFade = (theme: Theme) => theme.controls.md * 4;

/**
 * Where a block sits on screen when its fade starts and finishes, as fractions
 * of the viewport measured from the top.
 *
 * **This is the whole point of measuring.** Two earlier cuts keyed the fade to
 * an absolute scroll offset — first one shared window, then a per-block stagger
 * — and both had the same flaw: scroll offset is not visibility. The detail
 * starts at the fold, so "scroll 0" is already the moment the first block begins
 * sliding into view, and no amount of delay applied to a number that starts at
 * the wrong place fixes that. Read against the block's own top, 0.95 means "just
 * clear of the bottom edge" and 0.55 means "a little above the middle" on every
 * block, whatever it is and however far apart they are spaced.
 *
 * The gap between them is the fade's length — 40% of a screenful, roughly 280pt
 * on a phone, and deliberately long: this replaces two versions that were read
 * as too quick, and a fade tied to a scroll position can afford to be slow
 * because the reader controls the rate.
 *
 * `ENTER` is under 1 on purpose. At exactly 1 a block would start fading the
 * instant its top crossed the bottom edge of the screen, which is the behavior
 * being fixed; the margin holds it blank until it is properly on screen.
 */
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

/**
 * The chevron at the fold: there is more below, and it dims as the reader takes
 * it up.
 *
 * Absolutely positioned across the full width of whatever it is placed in, so it
 * centers there and cannot shift that block's content as the content's length
 * changes. The host places it inside the hero; it brings its own `bottom`, since
 * both callers want the same one.
 */
export function ScrollHint({
  color,
  reveal,
  revealFrom,
  revealTo,
  scrollOffset,
}: TArrival & { color: string }) {
  const theme = useTheme();

  // Resolved out here, not inside the worklet. A `useAnimatedStyle` body runs
  // on the UI runtime, where a function from this module is not a function but
  // a reference back across the bridge — calling one throws "Tried to
  // synchronously call a Remote Function". Only the resulting number is
  // captured.
  const fadeDistance = scrollHintFade(theme);

  // Two fades multiplied rather than one winning: the chevron arrives with the
  // detail and then leaves as the reader scrolls, and a reader who scrolls
  // during the arrival should see it do both at once rather than pop to full
  // strength. Both factors are 0–1, so the product is whichever is dimmer.
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

/**
 * One block below the fold, faded in as it comes onto the screen — measured
 * against its own position rather than against an absolute scroll offset (see
 * `REVEAL_ENTER`).
 *
 * A component, rather than an animated style per block back in the step, because
 * these are rendered from `.map()` and a hook cannot be called there — that
 * constraint is what makes this a module-level function and not an inline style.
 *
 * **Every block must be a flat direct child of the scroll content.** It reads
 * its position with `onLayout`, and `onLayout` reports a `y` relative to the
 * immediate parent. Flat against the content container, that `y` *is* the scroll
 * offset the block sits at, with nothing to convert. Grouped inside wrappers,
 * every block would report a `y` measured from its own group and reveal at a
 * plausible-but-wrong place — which looks like a tuning problem and is not one.
 * The price is that the spacing between blocks is `marginTop` per block instead
 * of `gap` on a wrapper.
 *
 * **The window is clamped to the end of the scroll**, and this is the part that
 * is easy to leave out and hard to notice: the last block sits close to the
 * bottom of the content, so its ideal `exit` — its top a little above the middle
 * of the screen — is a scroll position that does not exist. Unclamped it would
 * hold at partial opacity forever with no way for the reader to force it. The
 * clamp slides the whole window earlier rather than shortening it, so a block
 * pushed against the end still fades over the same distance.
 *
 * The arrival factor is multiplied in, so the step's own reveal still gates every
 * block — a reader who scrolls during those first seconds gets the dimmer of the
 * two, exactly as the chevron does. Both factors are 0–1, so the product is
 * whichever is dimmer.
 *
 * Zero opacity before the block is measured, and zero while it is below the
 * fold. Both are safe only because opacity does not touch layout: the content
 * keeps its full height, so there is always something to scroll and no block can
 * be stranded out of reach.
 */
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

  // The block's own offset within the scroll content — see the note above on why
  // this is `y` and nothing more.
  const onLayout = (event: LayoutChangeEvent) =>
    setTop(event.nativeEvent.layout.y);

  // Both resolved out here rather than in the worklet, which runs on the UI
  // runtime and can only capture plain values.
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
  // Spans the host's width so the chevron centers in it, rather than being
  // pinned to one side by a `left`/`right` of its own.
  scrollHint: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
});
