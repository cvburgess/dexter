import { ritualStepOptions } from "@/components/RitualStepSwitcher.shared";
import {
  SegmentedControl,
  type TSegmentedControlOption,
} from "@/components/SegmentedControl";
import type { TRitualState } from "@/utils/ritualSteps";

type TRitualStepSegmentsProps = {
  state: TRitualState;
  /** Jump to a step by index; the route hands this to `goToStep`. */
  onSelectStep: (index: number) => void;
};

/**
 * The ritual's step control on a large screen: every step as one segment of an
 * icon segmented control, the current one filled.
 *
 * A segmented control rather than the small screen's menu because there is room
 * to show the whole ritual at once — which makes it a progress indicator as
 * much as a picker, saying how far through the user is without being asked. It
 * is the same small-screen-menu / large-screen-controls split Today makes
 * between `DayViewSwitcher` and `DayPaneToggles`, and both ritual variants read
 * one `STEP_ICONS` table so the glyphs can't drift.
 *
 * `stretch={false}` is load-bearing: this sits in `LargeScreenHeader`'s actions
 * row, which has no width of its own, so `flex: 1` segments would divide
 * nothing and collapse.
 */
export function RitualStepSegments({
  state,
  onSelectStep,
}: TRitualStepSegmentsProps) {
  const options: TSegmentedControlOption<number>[] = ritualStepOptions(
    state,
    onSelectStep,
  ).map((option) => ({
    icon: option.icon,
    label: option.title,
    value: option.index,
  }));

  return (
    <SegmentedControl
      onChange={onSelectStep}
      options={options}
      stretch={false}
      testIDPrefix="ritual-step"
      value={state.step}
    />
  );
}
