import { VIEW_META } from "@/components/DayViewSwitcher";
import type { TIconName } from "@/components/Icon.types";
import {
  stepsFor,
  type TRitualState,
  type TRitualStepId,
} from "@/utils/ritualSteps";

/**
 * One icon per step, shared by both switcher variants so the menu row and the
 * web icon it corresponds to can never drift — the same job `VIEW_META` does
 * for `DayViewSwitcher`.
 *
 * A `Record` over `TRitualStepId`, so adding a step without an icon is a
 * compile error rather than a blank button. Two steps reuse the Today tab's
 * icons outright: they open the very surfaces those icons already stand for, so
 * inventing second glyphs for them would be the drift this table exists to
 * prevent. `open-tasks` is the evening's look at the same task list, so it
 * borrows Tasks' icon too. The journal's is spelled out rather than borrowed —
 * it is no longer a day view at all (DEX-105), so `VIEW_META` has no entry for
 * it to read.
 */
export const STEP_ICONS: Record<TRitualStepId, TIconName> = {
  horoscope: { sf: "sparkles", ionicon: "sparkles-outline" },
  journal: { sf: "book", ionicon: "book-outline" },
  calendar: VIEW_META.calendar.icon,
  backlog: { sf: "tray.full", ionicon: "file-tray-full-outline" },
  summary: { sf: "checkmark.circle", ionicon: "checkmark-circle-outline" },
  "open-tasks": VIEW_META.tasks.icon,
  review: { sf: "eyeglasses", ionicon: "glasses-outline" },
  // `cloud.sun` rather than `sunrise`: the two platforms draw the same step, and
  // a sunrise beside `partly-sunny-outline` read as a different one depending on
  // which device you opened.
  "preview-tomorrow": { sf: "cloud.sun", ionicon: "partly-sunny-outline" },
};

/**
 * What both step controls take — the menu (`RitualStepSwitcher`) and the
 * segmented control (`RitualStepSegments`, itself platform-split). Declared
 * once here so the two can't drift into taking different shapes for the same
 * job.
 */
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

/**
 * Builds the switcher's options for the ritual on screen: every step of the
 * active mode the user has turned on, in order, with the current one marked.
 *
 * Exported and pure so the wiring is unit-testable without a platform menu host
 * — the `dayViewOptions` precedent.
 */
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
