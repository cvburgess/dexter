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

/**
 * iOS implementation of the ritual's step control: a **real** `UISegmentedControl`,
 * hosted from SwiftUI as a `Picker` with `pickerStyle("segmented")`.
 *
 * Native rather than the drawn `SegmentedControl` the other platforms get,
 * because on iOS 26 the system draws this in liquid glass and throws in the
 * sliding selection animation, the haptics and the VoiceOver behavior for free
 * — all of which would otherwise be imitations that stop matching the OS the
 * moment Apple changes it. `app.json` pins `deploymentTarget: "26.1"`, so there
 * is no pre-glass iOS to fall back for.
 *
 * **It does not match the `GlassIconButton` beside it, and can't be made to.**
 * That button is `expo-glass-effect`'s `GlassView`; this control's track is
 * UIKit's own segmented-control material, painted by the system over anything
 * we put behind it — the `glassEffect` modifier below darkens what shows
 * through but cannot replace it. Making the two identical means giving up the
 * real `UISegmentedControl` and drawing both on one shared glass surface, which
 * is a live option rather than an oversight.
 *
 * The segments are SF Symbols: six words don't fit a toolbar, six glyphs do.
 * Each carries an `accessibilityLabel` modifier because an `Image` segment has
 * no text for VoiceOver to fall back on — the drawn variant solves the same
 * problem with `accessibilityLabel` on its pressable.
 *
 * **The selection can't be tinted, and that is the deal.** SwiftUI owns a
 * segmented picker's indicator and renders its labels as system-colored
 * templates: neither `tint()` on the picker nor `color` on a child `Image`
 * moves it (both tried on an iPad running iOS 26.5, both no-ops). That is
 * exactly what keeps the control looking like the OS, so the app's primary
 * color stops at this component's edge rather than the control being redrawn to
 * accept it.
 *
 * `Host matchContents` sizes the host to the control on both axes, the same way
 * `DateField.ios` hosts the compact date picker. That is the part of this file
 * most worth re-checking on device after an `@expo/ui` bump: these hosts size
 * asynchronously, and a mis-sized one renders untappable rather than merely
 * wrong (see `DayViewSwitcher`, `StatusButton` and `TaskCard`, which all pin
 * theirs to exact pixels for that reason).
 */
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
        // Coerced rather than trusted: the selection comes back as the raw
        // `tag` value, and `PickerField` already documents it arriving as a
        // plain string from the universal picker.
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
