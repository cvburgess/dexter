import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, View } from "react-native";

import { DayNavHeader } from "@/components/DayNavHeader";
import { GlassIconButton } from "@/components/GlassIconButton";
import { RitualModeButton } from "@/components/RitualModeButton";
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
  onNext: () => void;
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
 * The ritual as it works on a phone: one step at a time, `DayNav` centered
 * between two round `GlassIconButton`s — the AM/PM switch (or the modal's ✕) on
 * one side, advance-a-step on the other — and a swipe that pages between steps
 * rather than days (DEX-127).
 *
 * Both header controls are the same button at the same `controls.md` diameter
 * rather than one circle and one text pill, so they read as a matched pair and
 * neither can crowd `PeriodNav`'s day arrows the way a wider control would.
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
  onNext,
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
        /* Congrats ends the flow, so it offers nothing to advance to. */
        trailing={
          lastStep ? null : (
            <GlassIconButton
              accessibilityLabel="Next step"
              ionicon="chevron-forward"
              onPress={onNext}
              sfSymbol="chevron.right"
            />
          )
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
