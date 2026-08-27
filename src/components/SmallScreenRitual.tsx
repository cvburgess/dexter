import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DayNavHeader } from "@/components/DayNavHeader";
import { RitualModeButton } from "@/components/RitualModeButton";
import { RitualStepSwitcher } from "@/components/RitualStepSwitcher";
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

type TSmallScreenRitualProps = {
  state: TRitualState;
  onChangeDate: (date: Temporal.PlainDate) => void;
  /** A committed swipe: 1 for the next step, -1 for the previous one. */
  onSwipe: (direction: 1 | -1) => void;
  /** Jump straight to a step, from the switcher's menu. */
  onSelectStep: (index: number) => void;
  onToggleMode: () => void;
};

// One step at a time; a swipe pages between steps, not days (DEX-127).
// Fully controlled: every transition is utils/ritualSteps' business.
export function SmallScreenRitual({
  state,
  onChangeDate,
  onSwipe,
  onSelectStep,
  onToggleMode,
}: TSmallScreenRitualProps) {
  const theme = useTheme();
  const step = currentStep(state);
  const lastStep = isLastStep(state);
  // Suspends the step swipe on focus, same trade Today makes for Notes/Journal.
  // Held per layout, not in TRitualState — a breakpoint crossing safely resets it.
  const [editing, setEditing] = useState(false);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <DayNavHeader
        date={state.date}
        onChangeDate={onChangeDate}
        leading={<RitualModeButton mode={state.mode} onPress={onToggleMode} />}
        trailing={
          <RitualStepSwitcher onSelectStep={onSelectStep} state={state} />
        }
      />
      {/* Top inset only — SwipeablePage supplies the side gutter, matching
          LargeScreenRitual's own (docs/design.md, "Who owns spacing"). */}
      <View
        style={[
          styles.body,
          { paddingTop: ritualStepInsetTop(theme.space, false) },
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
