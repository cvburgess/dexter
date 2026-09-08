import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DayNav } from "@/components/DayNav";
import { GlassIconButton } from "@/components/GlassIconButton";
import { LargeScreenHeader } from "@/components/LargeScreenHeader";
import { RitualModeButton } from "@/components/RitualModeButton";
import { RitualStepSwitcher } from "@/components/RitualStepSwitcher";
import { RitualStepView } from "@/components/RitualStepView";
import { SwipeablePage } from "@/components/SwipeablePage";
import { SWIPEABLE_PAGE_MAX_WIDTH } from "@/utils/breakpoints";
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
  const canPrev = !isFirstStep(state);
  const canNext = !isLastStep(state);
  // A focused text field suspends the swipe here exactly as on the phone.
  const [editing, setEditing] = useState(false);
  const gutterWidth = theme.controls.md + theme.space.sm * 2;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <LargeScreenHeader
        actions={
          <>
            <RitualStepSwitcher onSelectStep={onSelectStep} state={state} />
            <RitualModeButton mode={state.mode} onPress={onToggleMode} />
          </>
        }
      >
        <DayNav date={state.date} onChangeDate={onChangeDate} />
      </LargeScreenHeader>
      {/* Only the top inset: SwipeablePage supplies the side gutter, doubled
          from the phone's (DEX-138) or a step reads as hanging off the toolbar. */}
      {/* Capping the row at the page's own max plus both gutters keeps the
          arrows beside the page on a wide window and off it just above 768. */}
      <View
        style={[
          styles.body,
          {
            paddingTop: ritualStepInsetTop(theme.space, true),
            maxWidth: SWIPEABLE_PAGE_MAX_WIDTH + gutterWidth * 2,
          },
        ]}
      >
        <View style={[styles.gutter, { width: gutterWidth }]}>
          {canPrev ? (
            <GlassIconButton
              accessibilityLabel="Previous ritual step"
              ionicon="chevron-back"
              onPress={() => onSwipe(-1)}
              sfSymbol="chevron.left"
            />
          ) : null}
        </View>
        <SwipeablePage
          canNext={canNext}
          canPrev={canPrev}
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
        <View style={[styles.gutter, { width: gutterWidth }]}>
          {canNext ? (
            <GlassIconButton
              accessibilityLabel="Next ritual step"
              ionicon="chevron-forward"
              onPress={() => onSwipe(1)}
              sfSymbol="chevron.right"
            />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    alignSelf: "center",
    flex: 1,
    flexDirection: "row",
    width: "100%",
  },
  gutter: {
    alignItems: "center",
    justifyContent: "center",
  },
});
