import { Temporal } from "@js-temporal/polyfill";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
import { useTheme } from "@/utils/theme";

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
 * between a leading control and a Next button, and a swipe that pages between
 * steps rather than days (DEX-127).
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
        trailing={lastStep ? null : <NextButton onPress={onNext} />}
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

/**
 * A text button rather than another round icon: "Next" is the flow's primary
 * action and needs a word, and two circles flanking `DayNav` would read as a
 * pair of equal-weight toggles. Drawn at the modal header's metrics
 * (`ModalHeaderButtons`) rather than `components/Button.tsx`, which carries a
 * full `space.md` of padding and is built for a full-width footer.
 */
function NextButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      accessibilityLabel="Next step"
      accessibilityRole="button"
      onPress={onPress}
      // Vertical padding only. The word is short, so the bare text is a thin
      // tap target — but widening it would run the button into `PeriodNav`'s
      // next-day chevron, which ends only a little way inside this slot's
      // edge. Growing the hit area upward and downward costs nothing: the slot
      // already spans the row's full height.
      style={{ paddingVertical: theme.space.sm }}
      testID="ritual-next-button"
    >
      <Text style={[theme.fonts.control, { color: theme.colors.primary }]}>
        Next
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
