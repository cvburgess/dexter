import { ReactNode } from "react";
import { Dimensions, LayoutChangeEvent, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInLeft,
  FadeInRight,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const COMMIT_DISTANCE_RATIO = 0.25;
const COMMIT_VELOCITY_THRESHOLD = 500;

/** Which way a swipe or gesture should commit: -1 previous day, 0 snap back, 1 next day. */
export function getSwipeCommitDirection(
  translationX: number,
  velocityX: number,
  width: number,
): -1 | 0 | 1 {
  "worklet";
  if (
    Math.abs(translationX) < width * COMMIT_DISTANCE_RATIO &&
    Math.abs(velocityX) < COMMIT_VELOCITY_THRESHOLD
  ) {
    return 0;
  }
  return translationX < 0 ? 1 : -1;
}

type TSwipeableDayProps = {
  dateKey: string;
  direction: -1 | 0 | 1;
  onSwipe: (direction: 1 | -1) => void;
  children: ReactNode;
};

export function SwipeableDay({
  dateKey,
  direction,
  onSwipe,
  children,
}: TSwipeableDayProps) {
  const translateX = useSharedValue(0);
  const width = useSharedValue(Dimensions.get("window").width);

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .withTestId("day-swipe")
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const commit = getSwipeCommitDirection(
        e.translationX,
        e.velocityX,
        width.value,
      );
      if (commit === 0) {
        translateX.value = withSpring(0);
        return;
      }
      translateX.value = 0;
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

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={onLayout}
        style={[styles.container, animatedStyle]}
        collapsable={false}
      >
        <Animated.View
          key={dateKey}
          entering={
            direction === 1
              ? FadeInRight
              : direction === -1
                ? FadeInLeft
                : undefined
          }
          style={styles.container}
        >
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
