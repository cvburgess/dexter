import { Temporal } from "@js-temporal/polyfill";

import { BacklogStep } from "@/components/BacklogStep";
import { BreatheStep } from "@/components/BreatheStep";
import { CalendarStep } from "@/components/CalendarStep";
import { EmptyScreen } from "@/components/EmptyScreen";
import { HoroscopeStep } from "@/components/HoroscopeStep";
import { JournalView } from "@/components/JournalView";
import { OpenTasksStep } from "@/components/OpenTasksStep";
import { PreviewTomorrowStep } from "@/components/PreviewTomorrowStep";
import { ReviewStep } from "@/components/ReviewStep";
import { SummaryStep } from "@/components/SummaryStep";
import type { TRitualMode, TRitualStep } from "@/utils/ritualSteps";

type TRitualStepViewProps = {
  step: TRitualStep;
  /** The day the ritual is running for; steps that show a day's data need it. */
  date: Temporal.PlainDate;
  /** Which ritual is running. Only the Journal reads it (DEX-151): it is the one
   * step id in both flows that asks a different set of questions in each. */
  mode: TRitualMode;
  /** Must be a stable `useState` setter — JournalView's reset-on-unmount
   * effect keys on its identity; an inline arrow re-fires its cleanup. */
  onEditingChange: (editing: boolean) => void;
};

// The DEX-34 seam: branches on step.id, nothing else about the flow changes.
// The default is the landing spot for an unbranched id — RitualStepView.test walks every step.
export function RitualStepView({
  step,
  date,
  mode,
  onEditingChange,
}: TRitualStepViewProps) {
  switch (step.id) {
    // DEX-164: the evening's counterpart to the morning horoscope — asks
    // nothing, so wind-down doesn't open on administrative work.
    case "breathe":
      return <BreatheStep date={date} />;
    case "horoscope":
      return <HoroscopeStep date={date} />;
    // DEX-105: not keyed on date — SwipeablePage remounts on day change
    // (ritualPageKey), which re-seeds the uncontrolled inputs.
    case "journal":
      return (
        <JournalView
          date={date.toString()}
          mode={mode}
          onEditingChange={onEditingChange}
        />
      );
    // DEX-140: reachable only while enableCalendar is on — stepsFor drops it.
    case "calendar":
      return <CalendarStep date={date} />;
    // DEX-141: unconditional — no preference drops the backlog.
    case "backlog":
      return <BacklogStep date={date} />;
    // DEX-146: unconditional like the backlog. Not the DEX-144 task-list step
    // — this dispatches a day's leftovers rather than re-listing them.
    case "open-tasks":
      return <OpenTasksStep date={date} onEditingChange={onEditingChange} />;
    // DEX-148: complements open-tasks. No onEditingChange — completed cards
    // render no field to suspend the swipe for.
    case "review":
      return <ReviewStep date={date} />;
    // DEX-149: the one step reading a day other than the ritual's own
    // (date + 1). Unconditional — the agenda, not the step, gates on calendar.
    case "preview-tomorrow":
      return (
        <PreviewTomorrowStep date={date} onEditingChange={onEditingChange} />
      );
    // DEX-144: counts the day and hands off, rather than re-listing it.
    case "summary":
      return <SummaryStep date={date} />;
    default:
      return <EmptyScreen message={step.title} />;
  }
}
