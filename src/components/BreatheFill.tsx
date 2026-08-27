import { useEffect, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import {
  BREATH_PHASE_LABELS,
  type TBreathePlan,
  type TBreathPhase,
} from "@/utils/breathing";
import { useTheme } from "@/utils/theme";

/** How long the word takes to arrive at the start of a run, and to leave at the end. */
const VOICE_FADE_MS = 600;

/** How long the fill takes to drop back to empty when a run is cut short. */
const SETTLE_MS = 900;

const PHASES: readonly TBreathPhase[] = ["inhale", "hold", "exhale"];

type TBreatheWordsProps = {
  plan: TBreathePlan;
  progress: SharedValue<number>;
  color: string;
  insetBottom: number;
};

// The three phase words stacked on one another — always all rendered, since
// buildBreathePlan hands an unused phase a flat zero table.
function BreatheWords({
  plan,
  progress,
  color,
  insetBottom,
}: TBreatheWordsProps) {
  return (
    <>
      {PHASES.map((phase) => (
        <BreatheWord
          key={phase}
          color={color}
          insetBottom={insetBottom}
          phase={phase}
          progress={progress}
          table={plan.words[phase]}
        />
      ))}
    </>
  );
}

function BreatheWord({
  phase,
  table,
  progress,
  color,
  insetBottom,
}: {
  phase: TBreathPhase;
  table: TBreathePlan["words"][TBreathPhase];
  progress: SharedValue<number>;
  color: string;
  insetBottom: number;
}) {
  const theme = useTheme();
  const { input, output } = table;

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, input, output, Extrapolation.CLAMP),
  }));

  return (
    // On the centering box, not the layer above: both word copies come
    // through here and stay on the same pixels without the clip knowing.
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        { paddingBottom: insetBottom },
        style,
      ]}
    >
      <Text style={[theme.fonts.display, { color }]}>
        {BREATH_PHASE_LABELS[phase]}
      </Text>
    </Animated.View>
  );
}

type TBreatheFillProps = {
  /** The plan running or just finished — outlives `running` going false so
   * `voice` can finish fading the words out. Null only before first Begin. */
  plan: TBreathePlan | null;
  /** Whether that plan is in flight. */
  running: boolean;
  /** Fired at a run's natural end. Must be referentially stable — it's an
   * animation-effect dependency; a fresh fn each render restarts the run. */
  onComplete: () => void;
  /** Bottom clearance for the centered phase word, passed in rather than
   * measured — the fill itself ignores it and paints the whole box. */
  insetBottom: number;
};

/** Rises on inhale, falls on exhale, drawn twice and inverted across the fill
 * line so the word stays legible on both halves; ignores Reduce Motion (DEX-164) — here the motion *is* the exercise. */
export function BreatheFill({
  plan,
  running,
  onComplete,
  insetBottom,
}: TBreatheFillProps) {
  const theme = useTheme();
  // How full the step is, 0 (empty) to 1.
  const level = useSharedValue(0);
  // The run's own 0→1, linear; word tables window onto it. Separate from
  // `level`, which is ambiguous (0.5 rising vs falling) where this only grows.
  const progress = useSharedValue(0);
  // Fades the word in with the run and out at its end.
  const voice = useSharedValue(0);

  // Only the height is measured: the fill travels vertically and the words
  // center themselves, so nothing here has a use for the width.
  const [height, setHeight] = useState(0);
  const onLayout = (event: LayoutChangeEvent) =>
    setHeight(event.nativeEvent.layout.height);

  // The fill's travel is its own height — unmeasured, it translates by zero
  // and covers the step.
  const ready = height > 0;

  useEffect(() => {
    if (!plan || !running || !ready) {
      // A plain write settles a stop rather than fighting it; progress is
      // frozen, not left to finish, or a cut-off word would pulse again.
      level.value = withTiming(0, { duration: SETTLE_MS });
      voice.value = withTiming(0, { duration: VOICE_FADE_MS });
      cancelAnimation(progress);
      return;
    }

    progress.value = 0;
    progress.value = withTiming(1, {
      duration: plan.totalMs,
      // Linear — bending it here would bend the legs and word windows too.
      easing: Easing.linear,
    });
    voice.value = withTiming(1, { duration: VOICE_FADE_MS });

    // Explicit worklet — reached via a ternary inside .map, which the babel
    // plugin doesn't auto-workletize, and an unworkletized fn on the UI thread throws.
    const reportEnd = (finished?: boolean) => {
      "worklet";
      if (finished) runOnJS(onComplete)();
    };

    const last = plan.session.length - 1;
    level.value = 0;
    level.value = withSequence(
      ...plan.session.map((leg, index) =>
        withTiming(
          plan.levels[index],
          {
            duration: leg.ms,
            // Eased, unlike the horoscope's linear color breath — a lung has
            // momentum a color doesn't; a hold times to its own level for free.
            easing: Easing.inOut(Easing.sin),
          },
          index === last ? reportEnd : undefined,
        ),
      ),
    );
  }, [level, onComplete, plan, progress, ready, running, voice]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - level.value) * height }],
  }));

  // The exact opposite of the fill's travel, so the clipped copy of the word
  // lands on the same pixels as the copy behind it.
  const wordCounterStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -(1 - level.value) * height }],
  }));

  const voiceStyle = useAnimatedStyle(() => ({ opacity: voice.value }));

  return (
    <View
      onLayout={onLayout}
      // Or the filled overlay would swallow the Begin button's presses.
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      testID="breathe-fill"
    >
      {ready && plan ? (
        <Animated.View style={[StyleSheet.absoluteFill, voiceStyle]}>
          <BreatheWords
            color={theme.colors.primary}
            insetBottom={insetBottom}
            plan={plan}
            progress={progress}
          />
        </Animated.View>
      ) : null}

      {ready ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.fill,
            { backgroundColor: theme.colors.primary },
            fillStyle,
          ]}
          testID="breathe-fill-surface"
        >
          {plan ? (
            <Animated.View style={[StyleSheet.absoluteFill, wordCounterStyle]}>
              <Animated.View style={[StyleSheet.absoluteFill, voiceStyle]}>
                <BreatheWords
                  color={theme.colors.primaryContent}
                  insetBottom={insetBottom}
                  plan={plan}
                  progress={progress}
                />
              </Animated.View>
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Clips the inner word copy to the filled part, so the two read as one word
  // changing color at the water line.
  fill: {
    overflow: "hidden",
  },
});
