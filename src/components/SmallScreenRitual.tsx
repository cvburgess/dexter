import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet } from "react-native";
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

/**
 * The ritual on a small screen: one step at a time, `DayNav` between the AM/PM
 * switch and the step switcher, and a swipe that pages between steps rather
 * than days (DEX-127).
 *
 * **Nothing here is a "next" button.** Advancing is the swipe, exactly as it is
 * for days on the Today tab, and the switcher is navigation — it jumps to any
 * step and, because its trigger wears the current step's icon, doubles as a
 * "you are here". The large-screen layout (`LargeScreenRitual`) shows every step
 * at once in a segmented control instead, and drops the swipe with it.
 *
 * Fully controlled: every transition is `utils/ritualSteps`' business, so this
 * holds no state of its own.
 */
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
      <SwipeablePage
        canNext={!lastStep}
        canPrev={!isFirstStep(state)}
        direction={state.direction}
        onSwipe={onSwipe}
        pageKey={ritualPageKey(state)}
      >
        <RitualStepView date={state.date} step={step} />
      </SwipeablePage>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
