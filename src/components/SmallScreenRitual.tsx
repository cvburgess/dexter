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
  // Suspends the step swipe while a step's text field is focused, so a
  // horizontal drag positions the caret instead of paging — the same trade the
  // Today tab makes for Notes and Journal. Held per layout rather than in the
  // route's `TRitualState`: crossing the breakpoint remounts this and resets the
  // flag to `false`, which is the safe direction.
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
      {/* Only the top inset here: `SwipeablePage` supplies the side gutter, and
          this is the same `space.md` so a step that paints to its own edges —
          the horoscope's card does — sits the same distance off the header as
          it does off the sides. Matches what `LargeScreenRitual` has always
          added (see docs/design.md, "Who owns spacing"). */}
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
