import { Temporal } from "@js-temporal/polyfill";

import { BacklogStep } from "@/components/BacklogStep";
import { CalendarStep } from "@/components/CalendarStep";
import { EmptyScreen } from "@/components/EmptyScreen";
import { HoroscopeStep } from "@/components/HoroscopeStep";
import { JournalView } from "@/components/JournalView";
import { OpenTasksStep } from "@/components/OpenTasksStep";
import { PreviewTomorrowStep } from "@/components/PreviewTomorrowStep";
import { ReviewStep } from "@/components/ReviewStep";
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
 * here and nothing else about the flow has to change. Eight are built —
 * Horoscope (DEX-128), Journal (DEX-105), Calendar (DEX-140), Backlog
 * (DEX-141), Summary (DEX-144), Open tasks (DEX-146), Review (DEX-148) and
 * Preview tomorrow (DEX-149) — and the rest fall through to the default and
 * render their name centered.
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
    // DEX-146: the evening ritual's first step, and unconditional like the
    // backlog. Not the morning task-list step DEX-144 removed — that one copied
    // the Today list without replacing it, where this one dispatches a day's
    // leftovers rather than offering a second place to read them.
    case "open-tasks":
      return <OpenTasksStep date={date} onEditingChange={onEditingChange} />;
    // DEX-148: the other half of the evening's task pass — what got closed out,
    // where `open-tasks` two swipes back is what didn't. Takes no
    // `onEditingChange`: a completed card renames nothing, so this step has no
    // field to suspend the swipe for.
    case "review":
      return <ReviewStep date={date} />;
    // DEX-149: the one step that reads a day other than the ritual's own — it
    // previews `date + 1`, computed there rather than here so every other
    // branch keeps meaning "the day being walked through". Unconditional even
    // for a reader with no calendar: the agenda is what the preference gates,
    // not the step, since tomorrow's tasks are worth seeing either way. It is
    // also the evening's *last* step now, having replaced the summary there.
    case "preview-tomorrow":
      return <PreviewTomorrowStep date={date} />;
    // DEX-144: the morning's last step — it counts the day and hands the reader
    // over to their real task list rather than drawing a second copy of it here.
    // The morning's alone since DEX-149; see `ritualSteps` for why the evening
    // stopped closing on a count of a day it had just reviewed.
    case "summary":
      return <SummaryStep date={date} />;
    default:
      return <EmptyScreen message={step.title} />;
  }
}
