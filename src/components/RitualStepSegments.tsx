import {
  ritualStepOptions,
  type TRitualStepControlProps,
} from "@/components/RitualStepSwitcher.shared";
import {
  SegmentedControl,
  type TSegmentedControlOption,
} from "@/components/SegmentedControl";

// Android/web only — iOS hosts the real UISegmentedControl instead
// (RitualStepSegments.ios.tsx) for liquid glass. Doubles as a progress
// indicator (whole ritual visible at once); `stretch={false}` is load-bearing
// since LargeScreenHeader's actions row has no width of its own.
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
