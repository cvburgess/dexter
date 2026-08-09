import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";

import { LargeScreenRitual } from "@/components/LargeScreenRitual";
import { SmallScreenRitual } from "@/components/SmallScreenRitual";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import {
  advanceStep,
  createRitualState,
  goToStep,
  otherMode,
  withDate,
  withMode,
} from "@/utils/ritualSteps";

/**
 * The Ritual tab (DEX-127, part of DEX-34) — a guided walk through the start or
 * end of a day, one step at a time.
 *
 * A thin selector, the same role `today/index.tsx` plays: it owns the single
 * `TRitualState` and hands it to whichever layout fits the screen. Every
 * transition lives in `utils/ritualSteps`, so this file holds no rules of its
 * own — and one state means one ritual, whatever the window size, rather than a
 * second copy living in a modal somewhere.
 *
 * Both layouts render at every width, and the branch is inside the screen
 * rather than in the navigator, so a tablet crossing the breakpoint live (a
 * rotation, or a Split View resize) swaps layouts without losing its place.
 */
export default function RitualScreen() {
  const multiPane = useIsLargeDevice();

  // Seeded inside the initializer so the clock is read on mount rather than at
  // module load — an app launched in the morning and left open must not still
  // be offering the morning ritual after noon has passed on a fresh open.
  const [state, setState] = useState(() => createRitualState());

  // So "New Task" opened from this tab defaults its schedule to the viewed day,
  // the same contract Today and Week publish.
  usePublishViewedDay(state.date);

  const changeDate = (date: Temporal.PlainDate) =>
    setState((current) => withDate(current, date));
  const toggleMode = () =>
    setState((current) => withMode(current, otherMode(current.mode)));
  const selectStep = (index: number) =>
    setState((current) => goToStep(current, index));
  const swipe = (direction: 1 | -1) =>
    setState((current) => advanceStep(current, direction));

  return multiPane ? (
    <LargeScreenRitual
      onChangeDate={changeDate}
      onSelectStep={selectStep}
      onSwipe={swipe}
      onToggleMode={toggleMode}
      state={state}
    />
  ) : (
    <SmallScreenRitual
      onChangeDate={changeDate}
      onSelectStep={selectStep}
      onSwipe={swipe}
      onToggleMode={toggleMode}
      state={state}
    />
  );
}
