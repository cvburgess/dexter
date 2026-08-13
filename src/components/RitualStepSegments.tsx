import {
  ritualStepOptions,
  type TRitualStepControlProps,
} from "@/components/RitualStepSwitcher.shared";
import {
  SegmentedControl,
  type TSegmentedControlOption,
} from "@/components/SegmentedControl";

/**
 * The ritual's step control on a large screen: every step as one segment of an
 * icon segmented control, the current one filled.
 *
 * A segmented control rather than the small screen's menu because there is room
 * to show the whole ritual at once — which makes it a progress indicator as
 * much as a picker, saying how far through the user is without being asked.
 * Both ritual variants read one `STEP_ICONS` table so the glyphs can't drift.
 *
 * **Android and web only.** iOS hosts the real `UISegmentedControl` instead
 * (`RitualStepSegments.ios.tsx`) so it draws in the system's liquid glass; this
 * is the drawn approximation for the platforms with nothing to host — the same
 * split `GlassIconButton` and `DateField` make.
 *
 * `stretch={false}` is load-bearing: this sits in `LargeScreenHeader`'s actions
 * row, which claims half the width the centered nav leaves over — so `flex: 1`
 * segments would spread across all of it rather than sizing to the ritual's
 * steps, and the control would stop reading as a group of five buttons.
 */
export function RitualStepSegments({
  state,
  onSelectStep,
}: TRitualStepControlProps) {
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
