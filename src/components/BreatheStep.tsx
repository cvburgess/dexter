import { Temporal } from "@js-temporal/polyfill";
import { useCallback, useEffect, useState } from "react";
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
  const insets = useSafeAreaInsets();
  const isLargeDevice = useIsLargeDevice();
  const [preferences] = usePreferences();

  // Held as overrides rather than as state seeded from the preference, because
  // `usePreferences` hands back its placeholder row first: a `useState`
  // initializer would freeze the default three breaths for a user whose stored
  // count is six and never catch up. Reading through to the preference until
  // the control is touched costs nothing and cannot go stale.
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

  // What has to come off the bottom of anything centered in this step. The host
  // `SafeAreaView` omits the bottom edge (the native tab bar owns it) and the
  // ritual layout adds `ritualStepInsetTop` above, so a box centered in the
  // whole step reads low by both — the same reservation `SummaryStep` and
  // `EmptyScreen` make (see docs/design.md, "Who owns spacing").
  //
  // Computed here and handed to `BreatheFill` rather than measured again in it:
  // the phase word has to land on the *same* center as the controls it replaces,
  // and two derivations of one number is how they drift apart.
  const insetBottom =
    insets.bottom + ritualStepInsetTop(theme.space, isLargeDevice);

  return (
    <View style={styles.container} testID="breathe-step">
      <BreatheFill
        insetBottom={insetBottom}
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
        style={[
          styles.controls,
          {
            // Begin sits far clear of the two controls: they are a setting you
            // glance at once, and the button is the only thing on the step worth
            // reaching for. A multiple of the scale rather than a literal, the
            // way `beginSize` is a multiple of `controls.md` — the scale stops
            // at `lg`, and this gap is deliberately larger than anything on it.
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
              // Lifts the one thing on the step meant to be pressed. `LG`
              // rather than `MD` for the size of the shape, and `2XL` is for a
              // screen-sized surface — see docs/design.md, "Scrims and
              // shadows". It only reads on a light theme, which is the accepted
              // cost there.
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

        {/* Held in from the step's own edges as well as from each other. The
            side gutter `SwipeablePage` supplies is what keeps the *step* off the
            screen; this is the narrower column the two controls read best in,
            which is the step's own business (see docs/design.md, "Who owns
            spacing"). */}
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
          {/* The same dropdown Settings uses, rather than a segmented row: three
              techniques fit in a row today, but the row is the widest thing on
              the step and a fourth would not. `PickerField` also brings
              `FormRow`'s height, which is what keeps the `@expo/ui` `Host` from
              collapsing the way a bare `Picker` does. */}
          <PickerField
            label="Technique"
            options={BREATHING_TECHNIQUE_OPTIONS}
            selectedValue={technique}
            testID="breathe-technique-picker"
            onValueChange={setTechniqueOverride}
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
  // Children stretch rather than center: `FormRow` carries no width of its own,
  // so a centered `PickerField` would collapse to its content and sit the label
  // beside the menu instead of at opposite ends of the row. The count centers
  // itself below instead.
  settings: {
    alignSelf: "stretch",
  },
  count: {
    textAlign: "center",
  },
});
