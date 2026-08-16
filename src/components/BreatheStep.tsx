import { Temporal } from "@js-temporal/polyfill";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { BreatheFill } from "@/components/BreatheFill";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Slider } from "@/components/Slider";
import { usePreferences } from "@/hooks/usePreferences";
import {
  BREATHING_TECHNIQUE_OPTIONS,
  buildBreathePlan,
  MAX_BREATHS,
  MIN_BREATHS,
  resolveBreathCount,
  resolveBreathingTechniqueSetting,
  type TBreathePlan,
  type TBreathingTechnique,
  techniqueForDay,
} from "@/utils/breathing";
import { useTheme } from "@/utils/theme";

/** How long the controls take to get out of the way of a run, and to come back. */
const CONTROLS_FADE_MS = 400;

type TBreatheStepProps = {
  /** The day the ritual is running for — what `"shuffle"` picks its technique from. */
  date: Temporal.PlainDate;
};

/**
 * The evening ritual's first step (DEX-164): a few paced breaths before the
 * ritual asks anything of you.
 *
 * It exists for the reason the morning's Horoscope step does — opening a wind-
 * down on administrative work is jarring, so the first thing the ritual does is
 * something you can only do by stopping. Everything the step *says* is in
 * `utils/breathing`; everything it *draws* is in `BreatheFill`. What is left
 * here is the choosing.
 *
 * **The preference is a starting value, not a binding.** Adjusting the count or
 * the technique here changes this sitting only; the stored default is untouched
 * and comes back on the next visit, since `SwipeablePage` remounts the step
 * whenever the day, the mode or the step changes.
 */
export function BreatheStep({ date }: TBreatheStepProps) {
  const theme = useTheme();
  const [preferences] = usePreferences();

  // Held as overrides rather than as state seeded from the preference, because
  // `usePreferences` hands back its placeholder row first: a `useState`
  // initializer would freeze the default three breaths for a user whose stored
  // count is six and never catch up. Reading through to the preference until
  // the control is touched costs nothing and cannot go stale.
  const [breathsOverride, setBreathsOverride] = useState<number | null>(null);
  const [techniqueOverride, setTechniqueOverride] =
    useState<TBreathingTechnique | null>(null);

  const breaths = breathsOverride ?? resolveBreathCount(preferences.breathCount);
  const technique =
    techniqueOverride ??
    techniqueForDay(
      resolveBreathingTechniqueSetting(preferences.breathingTechnique),
      date,
    );

  // The plan and whether it is still going, together — rather than a plan that
  // becomes `null` at the end. `BreatheFill` fades its word out over the run's
  // end, so the plan those words are drawn from has to outlive the run itself.
  // A fresh object each press is what re-triggers the fill, so pressing Begin
  // twice runs twice.
  const [session, setSession] = useState<{
    plan: TBreathePlan;
    running: boolean;
  } | null>(null);
  const running = session?.running ?? false;

  const begin = () =>
    setSession({ plan: buildBreathePlan(technique, breaths), running: true });
  // One path out for both endings: a run that finished and a run that was
  // tapped away land in the same place, which is also the place the step
  // opened in.
  const finish = useCallback(
    () =>
      setSession((current) =>
        current ? { ...current, running: false } : current,
      ),
    [],
  );

  const controls = useSharedValue(1);
  useEffect(() => {
    controls.value = withTiming(running ? 0 : 1, {
      duration: CONTROLS_FADE_MS,
    });
  }, [controls, running]);
  const controlsStyle = useAnimatedStyle(() => ({ opacity: controls.value }));

  const beginSize = theme.controls.md * 3;

  return (
    <View style={styles.container} testID="breathe-step">
      <BreatheFill
        onComplete={finish}
        plan={session?.plan ?? null}
        running={running}
      />

      {/* Kept mounted through a run rather than unmounted, so the controls
          cross-fade both ways instead of popping back the instant the last
          exhale ends. `pointerEvents` is what makes the faded-out copy
          untappable — opacity alone would leave Begin live under the run. */}
      <Animated.View
        pointerEvents={running ? "none" : "auto"}
        style={[styles.controls, { gap: theme.space.lg }, controlsStyle]}
        testID="breathe-controls"
      >
        <Pressable
          accessibilityLabel="Begin breathing"
          accessibilityRole="button"
          onPress={begin}
          style={[
            styles.begin,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radii.full,
              height: beginSize,
              width: beginSize,
            },
          ]}
          testID="breathe-begin"
        >
          <Text
            style={[theme.fonts.title, { color: theme.colors.primaryContent }]}
          >
            Begin
          </Text>
        </Pressable>

        <View style={[styles.settings, { gap: theme.space.sm }]}>
          <Text style={[theme.fonts.body, { color: theme.colors.textSecondary }]}>
            {breaths === 1 ? "1 breath" : `${breaths} breaths`}
          </Text>
          <Slider
            accessibilityLabel="Number of breaths"
            max={MAX_BREATHS}
            min={MIN_BREATHS}
            onValueChange={setBreathsOverride}
            step={1}
            testID="breathe-count-slider"
            value={breaths}
          />
          <SegmentedControl
            onChange={setTechniqueOverride}
            options={[...BREATHING_TECHNIQUE_OPTIONS]}
            testIDPrefix="breathe-technique"
            value={technique}
          />
        </View>
      </Animated.View>

      {/* Only mounted while a run is in flight, so it can cover the whole step
          without ever competing with the Begin button for a press. */}
      {running ? (
        <Pressable
          accessibilityLabel="Stop breathing"
          accessibilityRole="button"
          onPress={finish}
          style={StyleSheet.absoluteFill}
          testID="breathe-stop"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Carries no side gutter and no top inset of its own — `SwipeablePage`
  // supplies the first and the ritual layouts the second (see docs/design.md,
  // "Who owns spacing").
  container: {
    flex: 1,
  },
  // The button and its two controls as one centered block, the shape
  // `SummaryStep` takes: there is no body here to hang from the top.
  controls: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  begin: {
    alignItems: "center",
    justifyContent: "center",
  },
  settings: {
    alignItems: "center",
    alignSelf: "stretch",
  },
});
