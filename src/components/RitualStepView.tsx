import { Temporal } from "@js-temporal/polyfill";

import { BacklogStep } from "@/components/BacklogStep";
import { CalendarStep } from "@/components/CalendarStep";
import { EmptyScreen } from "@/components/EmptyScreen";
import { HoroscopeStep } from "@/components/HoroscopeStep";
import { JournalView } from "@/components/JournalView";
import { SummaryStep } from "@/components/SummaryStep";
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
 * here and nothing else about the flow has to change. Five are built —
 * Horoscope (DEX-128), Journal (DEX-105), Calendar (DEX-140), Backlog
 * (DEX-141) and Summary (DEX-144) — and the rest fall through to the default
 * and render their name centered.
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
    case "horoscope":
      return <HoroscopeStep date={date} />;
    // DEX-105: the journal left the Today tab for the ritual, so this is the
    // only place it renders. Not keyed on the date — `SwipeablePage` remounts
    // the whole step on a day change (`ritualPageKey`), which is what re-seeds
    // the uncontrolled inputs.
    case "journal":
      return (
        <JournalView date={date.toString()} onEditingChange={onEditingChange} />
      );
    // DEX-140: only reachable while `preferences.enableCalendar` is on —
    // `stepsFor` drops the step entirely otherwise, so this branch never has to
    // stand in for a user who has no calendar.
    case "calendar":
      return <CalendarStep date={date} />;
    // DEX-141: unconditional, unlike all three steps above it — no preference
    // drops the backlog, since every user has one.
    case "backlog":
      return <BacklogStep date={date} />;
    // DEX-144: the only step both rituals share besides the journal, and the
    // last of each — it counts the day and hands the reader over to their real
    // task list rather than drawing a second copy of it here.
    case "summary":
      return <SummaryStep date={date} />;
    default:
      return <EmptyScreen message={step.title} />;
  }
}
