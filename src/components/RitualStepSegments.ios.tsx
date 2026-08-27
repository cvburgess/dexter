import { Host, Image, Picker } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  glassEffect,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";

import {
  ritualStepOptions,
  type TRitualStepControlProps,
} from "@/components/RitualStepSwitcher.shared";

// A real UISegmentedControl (liquid glass, haptics, VoiceOver for free) — it
// can't match GlassIconButton beside it, since UIKit paints its own material
// over whatever sits behind. Selection can't be tinted (tint()/color() are
// no-ops on iPad 26.5); Host matchContents sizes async like DayViewSwitcher's
// hosts, so re-check tappability on device after an @expo/ui bump.
export function RitualStepSegments({
  state,
  onSelectStep,
}: TRitualStepControlProps) {
  const options = ritualStepOptions(state, onSelectStep);

  return (
    <Host matchContents>
      <Picker
        modifiers={[
          pickerStyle("segmented"),
          glassEffect({ glass: { variant: "clear" }, shape: "capsule" }),
        ]}
        selection={state.step}
        testID="ritual-step-segments"
        // Coerced — the raw `tag` value arrives as a plain string, per
        // PickerField's own note on the universal picker.
        onSelectionChange={(selection) => onSelectStep(Number(selection))}
      >
        {options.map((option) => (
          <Image
            key={option.index}
            modifiers={[tag(option.index), accessibilityLabel(option.title)]}
            systemName={option.icon.sf}
          />
        ))}
      </Picker>
    </Host>
  );
}
