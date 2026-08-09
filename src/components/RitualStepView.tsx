import { EmptyScreen } from "@/components/EmptyScreen";
import type { TRitualStep } from "@/utils/ritualSteps";

type TRitualStepViewProps = {
  step: TRitualStep;
};

/**
 * The content of one ritual step.
 *
 * Every step is a placeholder for now — DEX-127 builds the navigation only, so
 * each one renders its name centered on the screen. This exists as its own
 * component rather than inline in `SmallScreenRitual` because it is the seam
 * each later DEX-34 sub-issue fills in: a step branches on `step.id` here and
 * nothing else about the flow has to change.
 *
 * Carries no side gutter of its own — `SwipeablePage` supplies the phone's (see
 * docs/design.md, "Who owns spacing").
 */
export function RitualStepView({ step }: TRitualStepViewProps) {
  return <EmptyScreen message={step.title} />;
}
