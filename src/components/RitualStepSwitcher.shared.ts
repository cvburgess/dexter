import { VIEW_META } from "@/components/DayViewSwitcher";
import type { TIconName } from "@/components/Icon.types";
import {
  stepsFor,
  type TRitualState,
  type TRitualStepId,
} from "@/utils/ritualSteps";

// Same job VIEW_META does for DayViewSwitcher/DayPaneToggles. calendar/
// open-tasks borrow Today's icons; journal's is spelled out (DEX-105, no VIEW_META entry).
export const STEP_ICONS: Record<TRitualStepId, TIconName> = {
  // Plain circle, echoing Begin — `lungs` has no Ionicons counterpart, and
  // near misses like wind/leaf-outline are exactly the drift below warns of.
  breathe: { sf: "circle.dotted", ionicon: "ellipse-outline" },
  horoscope: { sf: "sparkles", ionicon: "sparkles-outline" },
  journal: { sf: "book", ionicon: "book-outline" },
  calendar: VIEW_META.calendar.icon,
  backlog: { sf: "tray.full", ionicon: "file-tray-full-outline" },
  summary: { sf: "checkmark.circle", ionicon: "checkmark-circle-outline" },
  "open-tasks": VIEW_META.tasks.icon,
  review: { sf: "eyeglasses", ionicon: "glasses-outline" },
  // `cloud.sun`, not `sunrise` — beside partly-sunny-outline it read as a
  // different step depending on which device you opened.
  "preview-tomorrow": { sf: "cloud.sun", ionicon: "partly-sunny-outline" },
};

// What both step controls take, declared once so they can't drift.
export type TRitualStepControlProps = {
  state: TRitualState;
  /** Jump to a step by index; the route hands this to `goToStep`. */
  onSelectStep: (index: number) => void;
};

export type TRitualStepOption = {
  /** The step's index, which is what `goToStep` takes. */
  index: number;
  id: TRitualStepId;
  title: string;
  icon: TIconName;
  /** Whether this is the step on screen. */
  isCurrent: boolean;
  onSelect: () => void;
};

// Exported and pure, testable without a platform menu host — the
// dayViewOptions/paneToggleOptions precedent.
export function ritualStepOptions(
  state: TRitualState,
  onSelectStep: (index: number) => void,
): TRitualStepOption[] {
  return stepsFor(state).map((step, index) => ({
    index,
    id: step.id,
    title: step.title,
    icon: STEP_ICONS[step.id],
    isCurrent: index === state.step,
    onSelect: () => onSelectStep(index),
  }));
}
