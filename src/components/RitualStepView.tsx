import { Temporal } from "@js-temporal/polyfill";

import { EmptyScreen } from "@/components/EmptyScreen";
import { HoroscopeStep } from "@/components/HoroscopeStep";
import type { TRitualStep } from "@/utils/ritualSteps";

type TRitualStepViewProps = {
  step: TRitualStep;
  /** The day the ritual is walking through — every step is scoped to it. */
  date: Temporal.PlainDate;
};

/**
 * The content of one ritual step.
 *
 * This exists as its own component rather than inline in `SmallScreenRitual`
 * because it is the seam each DEX-34 sub-issue fills in: a step branches on
 * `step.id` here and nothing else about the flow has to change. DEX-128 was the
 * first to use it; the steps with no branch yet still render their name
 * centered on the screen.
 *
 * Carries no side gutter of its own — `SwipeablePage` supplies the phone's (see
 * docs/design.md, "Who owns spacing").
 */
export function RitualStepView({ step, date }: TRitualStepViewProps) {
  if (step.id === "horoscope") return <HoroscopeStep date={date} />;

  return <EmptyScreen message={step.title} />;
}
