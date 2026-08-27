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

/**
 * The ritual on a large screen: the same flow as the phone, laid out for a
 * window rather than squeezed into one (DEX-127).
 *
 * It runs **in the tab**, not in a modal. An earlier cut opened the phone
 * experience in a form sheet from a play button, which meant two copies of the
 * ritual state and a route that showed nothing on its own; one route rendering
 * one flow is both simpler and linkable.
 *
 * One difference from `SmallScreenRitual`, and it is about having room: the
 * steps are a segmented control in the toolbar rather than a menu, so the whole
 * ritual is visible and its progress readable at a glance.
 *
 * The swipe is **not** a difference — `SwipeablePage` wraps the step here too.
 * That departs from the large-screen Today tab, which deliberately has no
 * swipe, and the reason it should: paging days is navigation between equals,
 * where the nav arrows say plainly what a gesture only implies, but a ritual is
 * a sequence you move *through*, and a trackpad or touchscreen swipe is the
 * most direct way to say "next". It costs nothing to offer alongside the
 * segments.
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
      {/* Only the top inset here: `SwipeablePage` supplies the side gutter, on
          this layout exactly as it does on the phone, so the step never pads
          itself from its container's edge (see docs/design.md, "Who owns
          spacing").

          **Twice that gutter**, not equal to it (DEX-138). Once the page is
          capped and centered, a step that paints to its own edges — the
          horoscope's card does — reads as hanging off the toolbar at a matching
          inset, because the window leaves far more air at its sides than the
          gutter ever will. Derived from the same token the sides use so the two
          cannot drift; the phone keeps them equal, having no centering bands to
          answer to. */}
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
