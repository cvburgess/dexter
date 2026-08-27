import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DayNav } from "@/components/DayNav";
import { LargeScreenHeader } from "@/components/LargeScreenHeader";
import { RitualModeButton } from "@/components/RitualModeButton";
import { RitualStepSegments } from "@/components/RitualStepSegments";
import { RitualStepView } from "@/components/RitualStepView";
import { SwipeablePage } from "@/components/SwipeablePage";
import {
  currentStep,
  isFirstStep,
  isLastStep,
  ritualPageKey,
  ritualStepInsetTop,
  type TRitualState,
} from "@/utils/ritualSteps";
import { useTheme } from "@/utils/theme";

type TLargeScreenRitualProps = {
  state: TRitualState;
  onChangeDate: (date: Temporal.PlainDate) => void;
  onToggleMode: () => void;
  onSelectStep: (index: number) => void;
  /** A committed swipe: 1 for the next step, -1 for the previous one. */
  onSwipe: (direction: 1 | -1) => void;
};

/** The ritual on a large screen (DEX-127): one route, one state copy — a
 * sequence moved through via SwipeablePage, unlike Today's arrows. */
export function LargeScreenRitual({
  state,
  onChangeDate,
  onToggleMode,
  onSelectStep,
  onSwipe,
}: TLargeScreenRitualProps) {
  const theme = useTheme();
  const step = currentStep(state);
  const lastStep = isLastStep(state);
  // A focused text field suspends the swipe here exactly as on the phone.
  const [editing, setEditing] = useState(false);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <LargeScreenHeader
        actions={
          <>
            <RitualStepSegments onSelectStep={onSelectStep} state={state} />
            <RitualModeButton mode={state.mode} onPress={onToggleMode} />
          </>
        }
      >
        <DayNav date={state.date} onChangeDate={onChangeDate} />
      </LargeScreenHeader>
      {/* Only the top inset: SwipeablePage supplies the side gutter, doubled
          from the phone's (DEX-138) or a step reads as hanging off the toolbar. */}
      <View
        style={[
          styles.body,
          { paddingTop: ritualStepInsetTop(theme.space, true) },
        ]}
      >
        <SwipeablePage
          canNext={!lastStep}
          canPrev={!isFirstStep(state)}
          direction={state.direction}
          enabled={!editing}
          onSwipe={onSwipe}
          pageKey={ritualPageKey(state)}
        >
          {/* `setEditing` passed raw, not wrapped — see `RitualStepView`'s
              `onEditingChange`. */}
          <RitualStepView
            date={state.date}
            mode={state.mode}
            onEditingChange={setEditing}
            step={step}
          />
        </SwipeablePage>
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
