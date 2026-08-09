import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DayNav } from "@/components/DayNav";
import { LargeScreenHeader } from "@/components/LargeScreenHeader";
import { RitualModeButton } from "@/components/RitualModeButton";
import { RitualStepSegments } from "@/components/RitualStepSegments";
import { RitualStepView } from "@/components/RitualStepView";
import { currentStep, type TRitualState } from "@/utils/ritualSteps";
import { useTheme } from "@/utils/theme";

type TLargeScreenRitualProps = {
  state: TRitualState;
  onChangeDate: (date: Temporal.PlainDate) => void;
  onToggleMode: () => void;
  onSelectStep: (index: number) => void;
};

/**
 * The ritual on a large screen: the same flow as the phone, laid out for a
 * window rather than squeezed into one (DEX-127).
 *
 * It runs **in the tab**, not in a modal. An earlier cut opened the phone
 * experience in a form sheet from a play button, which meant two copies of the
 * ritual state and a route that showed nothing on its own; one route rendering
 * one flow is both simpler and linkable.
 *
 * Two differences from `SmallScreenRitual`, both about having room. The steps
 * are a segmented control in the toolbar rather than a menu, so the whole
 * ritual is visible and its progress readable at a glance. And there is no
 * swipe: the segments are the way through, exactly as `DayNav`'s arrows are the
 * only way to change days on the large-screen Today tab.
 *
 * `DayNav` sits flush at the gutter, matching the Week tab rather than Today —
 * Today centers its nav inside a slot capped to the Tasks pane so it labels
 * that column, and there is no column here to label.
 */
export function LargeScreenRitual({
  state,
  onChangeDate,
  onToggleMode,
  onSelectStep,
}: TLargeScreenRitualProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <LargeScreenHeader
        actions={
          <>
            <RitualModeButton mode={state.mode} onPress={onToggleMode} />
            <RitualStepSegments onSelectStep={onSelectStep} state={state} />
          </>
        }
      >
        <DayNav date={state.date} onChangeDate={onChangeDate} />
      </LargeScreenHeader>
      {/* The body's gutter is supplied here rather than by the step, matching
          the pane rows on Today and Week — a component doesn't pad itself from
          its container's edge (see docs/design.md, "Who owns spacing"). On the
          phone `SwipeablePage` does the same job. */}
      <View
        style={[
          styles.body,
          { paddingHorizontal: theme.space.md, paddingTop: theme.space.md },
        ]}
      >
        <RitualStepView step={currentStep(state)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
});
