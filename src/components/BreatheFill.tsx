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
};

/**
 * The three phase words stacked on one another, each fading in for the legs it
 * belongs to.
 *
 * All three always render — which of them a technique actually uses is a
 * question `buildBreathePlan` has already answered by handing an unused phase a
 * flat zero table, so nothing here has to branch on the technique.
 */
function BreatheWords({ plan, progress, color }: TBreatheWordsProps) {
  return (
    <>
      {PHASES.map((phase) => (
        <BreatheWord
          key={phase}
          color={color}
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
}: {
  phase: TBreathPhase;
  table: TBreathePlan["words"][TBreathPhase];
  progress: SharedValue<number>;
  color: string;
}) {
  const theme = useTheme();
  const { input, output } = table;

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, input, output, Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.center, style]}>
      <Text style={[theme.fonts.display, { color }]}>
        {BREATH_PHASE_LABELS[phase]}
      </Text>
    </Animated.View>
  );
}

type TBreatheFillProps = {
  /**
   * The plan being run, or the one that just finished — `null` only before the
   * first press of Begin.
   *
   * Outliving its own run is the point: `running` goes false the moment a run
   * ends, and dropping the plan on that render would unmount the words while
   * `voice` was still fading them out.
   */
  plan: TBreathePlan | null;
  /** Whether that plan is in flight. */
  running: boolean;
  /**
   * Fired when a run reaches its end under its own steam. **Must be
   * referentially stable** — it is a dependency of the effect that starts the
   * animation, so a fresh function each render would restart the run on every
   * re-render of the step above.
   */
  onComplete: () => void;
};

/**
 * The Breathe step's background: a wall of the theme's primary that rises on
 * the inhale and falls on the exhale, with the phase word held at the center.
 *
 * Modeled on `SunriseBackground` — an `absoluteFill` layer that measures its
 * own box rather than reading the window, since `SwipeablePage` caps the step's
 * column on a large screen. Like the sunrise it fills the *step*, not the
 * screen: the ritual's gutter and toolbar stay where they are.
 *
 * **The word is drawn twice and inverts across the fill line.** `primaryContent`
 * is legible on `primary` and invisible on the plain background, and the fill
 * crosses the center of the step twice per breath, so a single copy in either
 * color would disappear for half of every cycle. Instead a `primary` copy sits
 * on the neutral ground and a `primaryContent` copy sits inside the fill, which
 * clips it: the fill translates down by the empty share of its height and the
 * inner copy translates *up* by the same amount, so it holds still on screen
 * while its clip window slides over it. Both are transforms, so the whole thing
 * stays on the compositor. The fill's box is square, so the `overflow: hidden`
 * doing the clipping costs nothing — the offscreen-rendering trap
 * `HoroscopeStep` documents needs a rounded one.
 *
 * **This is the one animation in the app that ignores Reduce Motion** (DEX-164).
 * Everywhere else the motion decorates something that is legible without it;
 * here it *is* the exercise, and it only runs when the user has pressed Begin.
 * Stopping it would leave a blank step and a word with nothing to pace it.
 */
export function BreatheFill({ plan, running, onComplete }: TBreatheFillProps) {
  const theme = useTheme();
  // How full the step is, 0 (empty) to 1.
  const level = useSharedValue(0);
  // The run's own 0→1, linear across its whole length; the word tables are
  // windows onto it. Separate from `level` because `level` is ambiguous — 0.5
  // means one thing rising and another falling — where this only ever
  // increases.
  const progress = useSharedValue(0);
  // Fades the word in with the run and out at its end.
  const voice = useSharedValue(0);

  // Only the height is measured: the fill travels vertically and the words
  // center themselves, so nothing here has a use for the width.
  const [height, setHeight] = useState(0);
  const onLayout = (event: LayoutChangeEvent) =>
    setHeight(event.nativeEvent.layout.height);

  // Nothing can be drawn before the box is measured: the fill's travel is its
  // height, so an unmeasured one would translate by zero and cover the step.
  const ready = height > 0;

  useEffect(() => {
    if (!plan || !running || !ready) {
      // A plain write cancels whatever is running on the value, which is what
      // makes tapping to stop a run settle it rather than fight it. The end of
      // a *finished* run is the same call and a no-op — every technique already
      // leaves the fill empty (see `BREATHING_TECHNIQUES`), so there is no
      // special completion state to unwind.
      level.value = withTiming(0, { duration: SETTLE_MS });
      voice.value = withTiming(0, { duration: VOICE_FADE_MS });
      // Frozen rather than left to finish. A run cut off partway has a word
      // table mid-pulse, and a `progress` still travelling to 1 underneath the
      // fade would pulse the next word in and back out while the whole layer
      // was on its way out.
      cancelAnimation(progress);
      return;
    }

    progress.value = 0;
    progress.value = withTiming(1, {
      duration: plan.totalMs,
      // Linear, because the curve the eye reads belongs to the legs below and
      // to the word windows this drives; bending it here would bend both.
      easing: Easing.linear,
    });
    voice.value = withTiming(1, { duration: VOICE_FADE_MS });

    const last = plan.session.length - 1;
    level.value = 0;
    level.value = withSequence(
      ...plan.session.map((leg, index) =>
        withTiming(
          plan.levels[index],
          {
            duration: leg.ms,
            // Eased where the horoscope's breathing color is deliberately
            // linear: this one is a moving surface, and a lung has momentum
            // where a color has none. A hold is a timing to the level it is
            // already at, so the easing costs it nothing.
            easing: Easing.inOut(Easing.sin),
          },
          index === last
            ? (finished) => {
                // Guarded, or a cancelled run would report itself complete —
                // the plain write above resolves the sequence with
                // `finished: false`.
                if (finished) runOnJS(onComplete)();
              }
            : undefined,
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
  // Clips the inner copy of the word to the filled part of the step, which is
  // what makes the two copies read as one word changing color at the water line.
  fill: {
    overflow: "hidden",
  },
});
