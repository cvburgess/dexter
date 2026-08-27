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

/**
 * The ritual's step control on a small screen: a round button showing the step
 * on screen, opening a menu with a row per step — `DayViewSwitcher`'s shape,
 * applied to steps instead of day views.
 *
 * There is deliberately no "next" action here. Advancing is the swipe (as it is
 * for days on the Today tab), and the menu is navigation: it lets the user jump
 * anywhere in the ritual and, because the trigger wears the current step's
 * icon, also says where they are.
 *
 * Large screens have room to show every step at once and use
 * `RitualStepSegments` in the toolbar instead — the same small-screen-menu /
 * large-screen-controls split Today makes between `DayViewSwitcher` and
 * `DayPaneToggles`. Both read one `STEP_ICONS` table, so the two can't drift.
 */
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
