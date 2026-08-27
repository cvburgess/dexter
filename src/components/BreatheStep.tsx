import { Temporal } from "@js-temporal/polyfill";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { BreatheFill } from "@/components/BreatheFill";
import { PickerField } from "@/components/PickerField";
import { Slider } from "@/components/Slider";
import { useBreathAudio } from "@/hooks/useBreathAudio";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import {
  BREATHING_TECHNIQUE_OPTIONS,
  buildBreathePlan,
  describeBreathCount,
  MAX_BREATHS,
  MIN_BREATHS,
  resolveBreathCount,
  resolveBreathingTechniqueSetting,
  type TBreathePlan,
  type TBreathingTechnique,
  techniqueForDay,
} from "@/utils/breathing";
import { ritualStepInsetTop } from "@/utils/ritualSteps";
import { SHADOW_LG, useTheme } from "@/utils/theme";

/** How long the controls take to get out of the way of a run, and to come back. */
const CONTROLS_FADE_MS = 400;

type TBreatheStepProps = {
  /** The day the ritual is running for — what `"shuffle"` picks its technique from. */
  date: Temporal.PlainDate;
};

/** The evening's first step (DEX-164). **Starting value, not a binding** —
 * adjusting count/technique here doesn't touch the stored default. */
export function BreatheStep({ date }: TBreatheStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isLargeDevice = useIsLargeDevice();
  const [preferences] = usePreferences();

  // Overrides, not seeded state — usePreferences hands back a placeholder row
  // first, and a useState initializer would freeze that default forever.
  const [breathsOverride, setBreathsOverride] = useState<number | null>(null);
  const [techniqueOverride, setTechniqueOverride] =
    useState<TBreathingTechnique | null>(null);

  const breaths =
    breathsOverride ?? resolveBreathCount(preferences.breathCount);
  const technique =
    techniqueOverride ??
    techniqueForDay(
      resolveBreathingTechniqueSetting(preferences.breathingTechnique),
      date,
    );

  // Plan and running-state together, not a plan that goes null at the end —
  // BreatheFill fades its word out over the run's end and needs it to outlive.
  const [session, setSession] = useState<{
    plan: TBreathePlan;
    running: boolean;
  } | null>(null);
  const running = session?.running ?? false;

  // A ref, not state: useBreathAudio's cleanup closes over the previous
  // render, where state would still read "running" by the time it's asked.
  const endedNaturally = useRef(false);

  const begin = () => {
    endedNaturally.current = false;
    setSession({ plan: buildBreathePlan(technique, breaths), running: true });
  };

  // One path out for both endings; they differ only in what they leave for
  // the sound to read.
  const stop = useCallback(
    () =>
      setSession((current) =>
        current ? { ...current, running: false } : current,
      ),
    [],
  );
  const complete = useCallback(() => {
    endedNaturally.current = true;
    stop();
  }, [stop]);
  const quit = useCallback(() => {
    endedNaturally.current = false;
    stop();
  }, [stop]);

  // Takes the plan, not technique+count, so sound and fill can't disagree.
  useBreathAudio(session?.plan ?? null, running, endedNaturally);

  const controls = useSharedValue(1);
  useEffect(() => {
    controls.value = withTiming(running ? 0 : 1, {
      duration: CONTROLS_FADE_MS,
    });
  }, [controls, running]);
  const controlsStyle = useAnimatedStyle(() => ({ opacity: controls.value }));

  const beginSize = theme.controls.md * 3;

  // Same bottom reservation as SummaryStep/EmptyScreen, handed to BreatheFill
  // so the phase word lands on the same center as the controls it replaces.
  const insetBottom =
    insets.bottom + ritualStepInsetTop(theme.space, isLargeDevice);

  return (
    <View style={styles.container} testID="breathe-step">
      <BreatheFill
        insetBottom={insetBottom}
        onComplete={complete}
        plan={session?.plan ?? null}
        running={running}
      />

      {/* Kept mounted so controls cross-fade both ways; pointerEvents (not
          opacity alone) is what makes the faded-out copy untappable. */}
      <Animated.View
        pointerEvents={running ? "none" : "auto"}
        style={[
          styles.controls,
          {
            // A multiple of the scale, not a literal — the scale stops at
            // `lg` and this gap is deliberately larger than anything on it.
            gap: theme.space.lg * 5,
            paddingBottom: insetBottom,
          },
          controlsStyle,
        ]}
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
              // `LG` for the shape's size, not `MD` — see docs/design.md,
              // "Scrims and shadows"; only reads on a light theme.
              boxShadow: SHADOW_LG,
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

        {/* The narrower column these two controls read best in — the step's
            own business (docs/design.md, "Who owns spacing"). */}
        <View
          style={[
            styles.settings,
            { gap: theme.space.md, paddingHorizontal: theme.space.lg },
          ]}
        >
          <Text
            style={[
              styles.count,
              theme.fonts.body,
              { color: theme.colors.textSecondary },
            ]}
          >
            {describeBreathCount(breaths)}
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
          {/* Not a segmented row — a fourth technique wouldn't fit; PickerField's
              FormRow height keeps the @expo/ui Host from collapsing. */}
          <PickerField
            label="Technique"
            options={BREATHING_TECHNIQUE_OPTIONS}
            selectedValue={technique}
            testID="breathe-technique-picker"
            onValueChange={setTechniqueOverride}
          />
        </View>
      </Animated.View>

      {/* Only mounted mid-run, so it never competes with Begin for a press. */}
      {running ? (
        <Pressable
          accessibilityLabel="Stop breathing"
          accessibilityRole="button"
          onPress={quit}
          style={StyleSheet.absoluteFill}
          testID="breathe-stop"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // No side gutter/top inset of its own — SwipeablePage and the ritual
  // layouts own those (docs/design.md, "Who owns spacing").
  container: {
    flex: 1,
  },
  // Button + controls as one centered block, SummaryStep's shape.
  controls: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  begin: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Stretch, not center — FormRow has no width of its own, so a centered
  // PickerField would collapse instead of spanning the row.
  settings: {
    alignSelf: "stretch",
  },
  count: {
    textAlign: "center",
  },
});
