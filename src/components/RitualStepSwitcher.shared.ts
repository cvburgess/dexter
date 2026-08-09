import { VIEW_META } from "@/components/DayViewSwitcher";
import type { TIconName } from "@/components/Icon.types";
import {
  RITUAL_STEPS,
  type TRitualState,
  type TRitualStepId,
} from "@/utils/ritualSteps";

/**
 * One icon per step, shared by both switcher variants so the menu row and the
 * web icon it corresponds to can never drift — the same job `VIEW_META` does
 * for `DayViewSwitcher`/`DayPaneToggles`.
 *
 * A `Record` over `TRitualStepId`, so adding a step without an icon is a
 * compile error rather than a blank button. Four steps reuse the Today tab's
 * icons outright: they open the very surfaces those icons already stand for, so
 * inventing second glyphs for them would be the drift this table exists to
 * prevent. `open-tasks` is the evening's look at the same task list, so it
 * shares Tasks' icon too.
 */
export const STEP_ICONS: Record<TRitualStepId, TIconName> = {
  horoscope: { sf: "sparkles", ionicon: "sparkles-outline" },
  journal: VIEW_META.journal.icon,
  calendar: VIEW_META.calendar.icon,
  backlog: { sf: "tray.full", ionicon: "file-tray-full-outline" },
  tasks: VIEW_META.tasks.icon,
  congrats: { sf: "checkmark.circle", ionicon: "checkmark-circle-outline" },
  "open-tasks": VIEW_META.tasks.icon,
  review: { sf: "magnifyingglass", ionicon: "search-outline" },
  "preview-tomorrow": { sf: "sunrise", ionicon: "partly-sunny-outline" },
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
 * active mode, in order, with the current one marked.
 *
 * Exported and pure so the wiring is unit-testable without a platform menu host
 * — the `dayViewOptions` / `paneToggleOptions` precedent.
 */
export function ritualStepOptions(
  state: TRitualState,
  onSelectStep: (index: number) => void,
): TRitualStepOption[] {
  return RITUAL_STEPS[state.mode].map((step, index) => ({
    index,
    id: step.id,
    title: step.title,
    icon: STEP_ICONS[step.id],
    isCurrent: index === state.step,
    onSelect: () => onSelectStep(index),
  }));
}
