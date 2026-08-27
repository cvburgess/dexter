import { GlassIconButton } from "@/components/GlassIconButton";
import { IconMenu } from "@/components/IconMenu";
import type { TIconMenuOption } from "@/components/IconMenu.types";
import {
  ritualStepOptions,
  STEP_ICONS,
  type TRitualStepControlProps,
} from "@/components/RitualStepSwitcher.shared";
import { currentStep } from "@/utils/ritualSteps";
import { useTheme } from "@/utils/theme";

// Small-screen step control: DayViewSwitcher's shape applied to steps. No
// "next" action — advancing is the swipe; large screens use
// RitualStepSegments instead, both reading one STEP_ICONS table.
export function RitualStepSwitcher({
  state,
  onSelectStep,
}: TRitualStepControlProps) {
  const theme = useTheme();
  const icon = STEP_ICONS[currentStep(state).id];
  const options: TIconMenuOption[] = ritualStepOptions(state, onSelectStep).map(
    (option) => ({
      id: `${option.index}`,
      title: option.title,
      icon: option.icon,
      isSelected: option.isCurrent,
      onSelect: option.onSelect,
    }),
  );

  return (
    // Pinned to the button's size — @expo/ui's MenuView sizes async and a
    // content-sized trigger renders untappable on device.
    <IconMenu
      accessibilityLabel="Switch ritual step"
      sections={[{ options }]}
      style={{ width: theme.controls.md, height: theme.controls.md }}
    >
      <GlassIconButton
        accessibilityLabel="Switch ritual step"
        ionicon={icon.ionicon}
        sfSymbol={icon.sf}
      />
    </IconMenu>
  );
}
