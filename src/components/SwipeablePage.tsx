import { ReactNode, useEffect } from "react";
import { Dimensions, LayoutChangeEvent, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTheme } from "@/utils/theme";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const COMMIT_DISTANCE_RATIO = 0.25;
const COMMIT_VELOCITY_THRESHOLD = 500;

/** Which way a swipe or gesture should commit: -1 previous page, 0 snap back, 1 next page. */
export function getSwipeCommitDirection(
  translationX: number,
  velocityX: number,
  width: number,
): -1 | 0 | 1 {
  "worklet";
  const passesDistance =
    Math.abs(translationX) >= width * COMMIT_DISTANCE_RATIO;
  const passesVelocity = Math.abs(velocityX) >= COMMIT_VELOCITY_THRESHOLD;
  if (!passesDistance && !passesVelocity) {
    return 0;
  }
  // A fast flick can commit on velocity alone with a tiny (or even
  // opposite-signed) net translation, so prefer velocity's sign whenever
  // it's the signal that crossed its threshold.
  const sign = passesVelocity ? velocityX : translationX;
  return sign < 0 ? 1 : -1;
}

type TSwipeablePageProps = {
  /** Identifies the page on screen; changing it remounts (see below). */
  pageKey: string;
  direction: -1 | 0 | 1;
  onSwipe: (direction: 1 | -1) => void;
  /**
   * Whether there is a next/previous page to move to. A declined direction
   * springs back instead of committing — the host wouldn't change `pageKey`,
   * so nothing would remount to reset the drag and the content would stay
   * parked wherever the finger left it. Default true, which is what an
   * unbounded pager (the Today tab's days) wants.
   */
  canNext?: boolean;
  canPrev?: boolean;
  /** Disable the swipe gesture (e.g. while a note is being edited, so it
   * doesn't fight the editor's caret/selection drags). Defaults to enabled. */
  enabled?: boolean;
  children: ReactNode;
};

/**
 * A horizontally swipeable surface that pages between whatever its host counts
 * as a page: days on the Today tab (`SmallScreenToday`), steps in the Ritual
 * flow (`SmallScreenRitual`). The gesture, the intro animation and the phone's
 * side gutter are identical in both cases, so they live here once (DEX-127) —
 * only the arithmetic behind `pageKey` differs, and that belongs to the host.
 */
// Remount the swipeable surface whenever the page changes. A fresh mount starts
// with translateX back at 0, so the just-swiped-away page is never snapped back
// to center — which is what caused the old content to flash before the new page
// faded in. Resetting the drag offset by remounting (rather than mutating the
// shared value from a React hook) also keeps the reset off the render path and
// avoids the React Compiler flagging shared-value writes as immutable mutations.
export function SwipeablePage(props: TSwipeablePageProps) {
  return <SwipeablePageContent key={props.pageKey} {...props} />;
}

function SwipeablePageContent({
  direction,
  onSwipe,
  canNext = true,
  canPrev = true,
  enabled = true,
  children,
}: Omit<TSwipeablePageProps, "pageKey">) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const width = useSharedValue(Dimensions.get("window").width);
  // Page-intro progress, 0 → 1: fades/slides the freshly mounted page in from
  // the direction of travel. Driven by a plain shared value rather than an
  // `entering` layout animation — on the new architecture, entering animations
  // intermittently leave the mounted subtree blank or mis-measured (worse here
  // because the task cards contain async-sizing @expo/ui menu hosts).
  const intro = useSharedValue(direction === 0 ? 1 : 0);

  useEffect(() => {
    intro.value = withTiming(1, { duration: 300 });
  }, [intro]);

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
  };

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .withTestId("page-swipe")
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const commit = getSwipeCommitDirection(
        e.translationX,
        e.velocityX,
        width.value,
      );
      // Snap back for a swipe that didn't cross the threshold *and* for one
      // that did but has nowhere to go — a page at either end of a bounded
      // range. Both cases leave `pageKey` unchanged, so the spring is the only
      // thing that returns the content to center.
      if (
        commit === 0 ||
        (commit === 1 && !canNext) ||
        (commit === -1 && !canPrev)
      ) {
        translateX.value = withSpring(0);
        return;
      }
      // Don't reset translateX here. Doing so on the UI thread snaps the old
      // page's content back to center before React swaps in the new page a few
      // frames later, which is the flash we're fixing. Instead the drag offset
      // resets naturally when SwipeablePage remounts this content on the new
      // page.
      runOnJS(onSwipe)(commit);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: interpolate(
      Math.abs(translateX.value),
      [0, width.value],
      [1, 0.25],
      "clamp",
    ),
  }));

  // Matches the old FadeInRight/FadeInLeft look: slide in 25px from the
  // travel direction while fading up. Purely a style animation — it never
  // touches the subtree's layout.
  const introStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ translateX: (1 - intro.value) * 25 * direction }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={onLayout}
        // The phone's side gutter, supplied once here for whichever page is on
        // screen — none of Tasks/Notes/Journal/Calendar (or a ritual step)
        // carries a gutter of its own (see docs/design.md, "Who owns spacing").
        // `onLayout` reports the padded box, so the swipe threshold still
        // measures the full screen.
        style={[
          styles.container,
          { paddingHorizontal: theme.space.md },
          animatedStyle,
        ]}
        collapsable={false}
      >
        <Animated.View style={[styles.container, introStyle]}>
          {children}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
