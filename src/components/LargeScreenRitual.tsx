import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DayNav } from "@/components/DayNav";
import { Icon } from "@/components/Icon";
import type { TIconName } from "@/components/Icon.types";
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

const ARROW_PREV: TIconName = { sf: "arrow.left", ionicon: "arrow-back" };
const ARROW_NEXT: TIconName = { sf: "arrow.right", ionicon: "arrow-forward" };

/** Deliberately not `GlassIconButton`: a step arrow reads as the page's own
 * primary action, and glass washes out over the darker step backgrounds. */
function StepArrow({
  icon,
  label,
  onPress,
  size,
}: {
  icon: TIconName;
  label: string;
  onPress: () => void;
  size: number;
}) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.arrow,
        {
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radii.full,
          height: size,
          width: size,
        },
      ]}
    >
      <Icon
        color={theme.colors.primaryContent}
        ionicon={icon.ionicon}
        sf={icon.sf}
        size={size * 0.5}
      />
    </TouchableOpacity>
  );
}

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
  const arrowSize = theme.controls.md * 2;
  const gutterMin = arrowSize + theme.space.md * 2;

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
      {/* Only the top inset — SwipeablePage pads its own sides, doubled from
          the phone's (DEX-138) or a step hangs off the toolbar. */}
      <View
        style={[
          styles.body,
          { paddingTop: ritualStepInsetTop(theme.space, true) },
        ]}
      >
        {/* The page takes its max and the gutters split what is left, so each
            arrow floats mid-gutter; `minWidth` keeps it off the page below 880. */}
        <View style={[styles.gutter, { minWidth: gutterMin }]}>
          {canPrev ? (
            <StepArrow
              icon={ARROW_PREV}
              label="Previous ritual step"
              onPress={() => onSwipe(-1)}
              size={arrowSize}
            />
          ) : null}
        </View>
        <View style={styles.pageColumn}>
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
        </View>
        <View style={[styles.gutter, { minWidth: gutterMin }]}>
          {canNext ? (
            <StepArrow
              icon={ARROW_NEXT}
              label="Next ritual step"
              onPress={() => onSwipe(1)}
              size={arrowSize}
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
    flex: 1,
    flexDirection: "row",
  },
  gutter: {
    alignItems: "center",
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: "center",
  },
  // Basis, not grow: the page claims its max first and the gutters divide the
  // rest, then it shrinks below 880 where there is nothing left to divide.
  pageColumn: {
    flexBasis: SWIPEABLE_PAGE_MAX_WIDTH,
    flexGrow: 0,
    flexShrink: 1,
  },
  arrow: {
    alignItems: "center",
    justifyContent: "center",
  },
});
