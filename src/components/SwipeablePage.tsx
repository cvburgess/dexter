import { ReactNode, useEffect } from "react";
import { Dimensions, LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SWIPEABLE_PAGE_MAX_WIDTH } from "@/utils/breakpoints";
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
  // A fast flick can commit on velocity alone with a tiny net translation,
  // so prefer velocity's sign when it's the one that crossed threshold.
  const sign = passesVelocity ? velocityX : translationX;
  return sign < 0 ? 1 : -1;
}

type TSwipeablePageProps = {
  /** Identifies the page on screen; changing it remounts (see below). */
  pageKey: string;
  direction: -1 | 0 | 1;
  onSwipe: (direction: 1 | -1) => void;
  /** Whether there's a next/previous page. A declined direction springs back
   * instead of committing, since `pageKey` wouldn't change to reset the drag. */
  canNext?: boolean;
  canPrev?: boolean;
  /** Disable the swipe gesture (e.g. while a note is being edited, so it
   * doesn't fight the editor's caret/selection drags). Defaults to enabled. */
  enabled?: boolean;
  children: ReactNode;
};

// Pages between whatever the host counts as a page — lives here once (DEX-127).
// Remounts on pageKey change so translateX resets without a render-path write.
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
  // A seed until the first onLayout, clamped to the capped page rather than
  // the window — else a pre-layout gesture measures against a threshold it never has.
  const width = useSharedValue(
    Math.min(Dimensions.get("window").width, SWIPEABLE_PAGE_MAX_WIDTH),
  );
  // A plain shared value, not an `entering` layout animation — those
  // intermittently leave the subtree blank/mis-measured on the new architecture.
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
      // Snap back below threshold, or past it with nowhere to go — both leave
      // pageKey unchanged, so the spring is the only return to center.
      if (
        commit === 0 ||
        (commit === 1 && !canNext) ||
        (commit === -1 && !canPrev)
      ) {
        translateX.value = withSpring(0);
        return;
      }
      // Don't reset translateX here — on the UI thread it snaps back before
      // React swaps pages, the flash this remount design fixes.
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

  // Matches the old FadeInRight/FadeInLeft look — a style animation only,
  // never touches layout.
  const introStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ translateX: (1 - intro.value) * 25 * direction }],
  }));

  return (
    <GestureDetector gesture={pan}>
      {/* Full-bleed stage under the capped page — the gesture stays live to
          the window edge; collapsable={false} since it's the gesture host. */}
      <View style={styles.stage} collapsable={false}>
        <Animated.View
          onLayout={onLayout}
          testID="swipeable-page"
          // The phone's side gutter (docs/design.md). Measures this capped
          // box, not the stage, or a desktop commit needs half a screen.
          style={[
            styles.page,
            { paddingHorizontal: theme.space.md },
            animatedStyle,
          ]}
        >
          <Animated.View style={[styles.container, introStyle]}>
            {children}
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stage: {
    flex: 1,
    alignItems: "center",
  },
  // A page holds a column no wider than a tablet in portrait, not a pane
  // that flexes to fill the window (DEX-138).
  page: {
    flex: 1,
    width: "100%",
    maxWidth: SWIPEABLE_PAGE_MAX_WIDTH,
  },
});
