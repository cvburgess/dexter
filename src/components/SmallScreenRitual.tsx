import { Temporal } from "@js-temporal/polyfill";
import { Platform, StyleSheet, View } from "react-native";

import { DayNavHeader } from "@/components/DayNavHeader";
import { GlassIconButton } from "@/components/GlassIconButton";
import { RitualModeButton } from "@/components/RitualModeButton";
import { RitualStepSwitcher } from "@/components/RitualStepSwitcher";
import { RitualStepView } from "@/components/RitualStepView";
import { SwipeablePage } from "@/components/SwipeablePage";
import {
  currentStep,
  isFirstStep,
  isLastStep,
  type TRitualState,
} from "@/utils/ritualSteps";

type TSmallScreenRitualProps = {
  state: TRitualState;
  onChangeDate: (date: Temporal.PlainDate) => void;
  /** A committed swipe: 1 for the next step, -1 for the previous one. */
  onSwipe: (direction: 1 | -1) => void;
  /** Jump straight to a step, from the switcher's menu rows or icons. */
  onSelectStep: (index: number) => void;
  /**
   * Renders the AM/PM switch in the leading slot. The tab passes this; the
   * modal doesn't, because on a large screen the ritual is chosen in the
   * toolbar that opened it.
   */
  onToggleMode?: () => void;
  /**
   * Renders a ✕ in the leading slot instead. The modal passes this; the tab
   * doesn't, because a tab has nothing to close. Exactly one of the two is
   * supplied, which is what keeps one component serving both surfaces.
   */
  onClose?: () => void;
};

/**
 * The ritual as it works on a phone: one step at a time, `DayNav` between the
 * AM/PM switch (or the modal's ✕) and the step switcher, and a swipe that pages
 * between steps rather than days (DEX-127).
 *
 * **Nothing here is a "next" button.** Advancing is the swipe, exactly as it is
 * for days on the Today tab, and the switcher is navigation — it jumps to any
 * step and, on native, wears the current step's icon so it doubles as a "you
 * are here". `RitualStepSwitcher` is platform-split: a menu on native, a button
 * per step on web (which is also the only option there — see that file).
 *
 * Two surfaces render this — the Ritual tab below the breakpoint, and the play
 * modal on large screens, which is the *same* experience deliberately rather
 * than a second one to maintain.
 *
 * **Frameless, unlike `SmallScreenToday`.** It returns a plain flex column and
 * leaves the `SafeAreaView` to whoever places it, because its two placers
 * genuinely disagree: the tab owns the top of the screen and must clear the
 * status bar, while the modal floats inside a form sheet that doesn't reach it
 * and would be pushed down by an inset it never needed. A frame belongs to the
 * placer (see docs/design.md, "Who owns spacing"), and the alternative — an
 * `edges` opt-out prop — is exactly the shape that document argues against.
 *
 * Fully controlled: every transition is `utils/ritualSteps`' business, so this
 * holds no state of its own and the tab and the modal can each own theirs.
 */
export function SmallScreenRitual({
  state,
  onChangeDate,
  onSwipe,
  onSelectStep,
  onToggleMode,
  onClose,
}: TSmallScreenRitualProps) {
  const step = currentStep(state);
  const lastStep = isLastStep(state);

  return (
    <View style={styles.container}>
      <DayNavHeader
        date={state.date}
        onChangeDate={onChangeDate}
        // The web switcher is a button per step — far too wide to float over
        // the nav — so that platform lays the header out in flow instead. See
        // `DayNavHeader`'s `layout` prop and `RitualStepSwitcher.web`.
        layout={Platform.OS === "web" ? "row" : "overlay"}
        leading={
          onClose ? (
            <GlassIconButton
              accessibilityLabel="Close ritual"
              ionicon="close"
              onPress={onClose}
              sfSymbol="xmark"
            />
          ) : onToggleMode ? (
            <RitualModeButton mode={state.mode} onPress={onToggleMode} />
          ) : null
        }
        trailing={
          <RitualStepSwitcher onSelectStep={onSelectStep} state={state} />
        }
      />
      {/* All three parts of the key matter: a step change plays the intro
          animation, and a date or mode change restarts the ritual, which has to
          re-seed each step's content the way a day change re-seeds Today's. */}
      <SwipeablePage
        canNext={!lastStep}
        canPrev={!isFirstStep(state)}
        direction={state.direction}
        onSwipe={onSwipe}
        pageKey={`${state.date.toString()}-${state.mode}-${step.id}`}
      >
        <RitualStepView step={step} />
      </SwipeablePage>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
