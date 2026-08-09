import type { TRitualState } from "@/utils/ritualSteps";

export type TRitualStepSegmentsProps = {
  state: TRitualState;
  /** Jump to a step by index; the route hands this to `goToStep`. */
  onSelectStep: (index: number) => void;
};
