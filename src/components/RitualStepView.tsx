import { Temporal } from "@js-temporal/polyfill";

import { EmptyScreen } from "@/components/EmptyScreen";
import { JournalView } from "@/components/JournalView";
import type { TRitualStep } from "@/utils/ritualSteps";

type TRitualStepViewProps = {
  step: TRitualStep;
  /** The day the ritual is running for; steps that show a day's data need it. */
  date: Temporal.PlainDate;
  /**
   * Fired as a step's text field gains/loses focus, so the layout can suspend
   * the step swipe while the caret is being positioned.
   *
   * **Must be referentially stable** — pass a `useState` setter, not an inline
   * arrow. `JournalView`'s reset-on-unmount effect depends on this callback's
   * identity, so a new function each render would re-run its cleanup and clear
   * the flag the moment a field was focused, leaving the swipe fighting the
   * editor.
   */
  onEditingChange: (editing: boolean) => void;
};

/**
 * The content of one ritual step.
 *
 * This is the seam each DEX-34 sub-issue fills in: a step branches on `step.id`
 * here and nothing else about the flow has to change. The ones still to be
 * built fall through to the default and render their name centered.
 *
 * Carries no side gutter of its own — `SwipeablePage` supplies it at both
 * widths on this tab (see docs/design.md, "Who owns spacing").
 */
export function RitualStepView({
  step,
  date,
  onEditingChange,
}: TRitualStepViewProps) {
  switch (step.id) {
    // DEX-105: the journal left the Today tab for the ritual, so this is the
    // only place it renders. Not keyed on the date — `SwipeablePage` remounts
    // the whole step on a day change (`ritualPageKey`), which is what re-seeds
    // the uncontrolled inputs.
    case "journal":
      return (
        <JournalView date={date.toString()} onEditingChange={onEditingChange} />
      );
    default:
      return <EmptyScreen message={step.title} />;
  }
}
