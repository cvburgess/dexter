import { GlassIconButton } from "@/components/GlassIconButton";
import { IconMenu } from "@/components/IconMenu";
import type { TIconMenuOption } from "@/components/IconMenu.types";
import {
  ritualStepOptions,
  STEP_ICONS,
} from "@/components/RitualStepSwitcher.shared";
import type { TRitualStepSwitcherProps } from "@/components/RitualStepSwitcher.types";
import { currentStep } from "@/utils/ritualSteps";
import { useTheme } from "@/utils/theme";

/**
 * The ritual's step switcher on native: a round button showing the step on
 * screen, opening a menu with a row per step — `DayViewSwitcher`'s shape,
 * applied to steps instead of day views.
 *
 * There is deliberately no "next" action here. Advancing is the swipe (as it is
 * for days on the Today tab), and the menu is navigation: it lets the user jump
 * anywhere in the ritual and, because the trigger wears the current step's
 * icon, also says where they are.
 *
 * The web variant (`RitualStepSwitcher.web.tsx`) lays the same options out as
 * one button per step instead — partly because a wide surface has room to show
 * the whole ritual at once, and partly because it *must*: `IconMenu.web` is the
 * app's last React Native `Modal`, which portals outside the vaul dialog that
 * renders `ritual-session` and would paint a menu nobody can click (see
 * docs/frontend.md).
 */
export function RitualStepSwitcher({
  state,
  onSelectStep,
}: TRitualStepSwitcherProps) {
  const theme = useTheme();
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
    // Pin the IconMenu host to the button's size: the native @expo/ui MenuView
    // sizes asynchronously and a content-sized trigger renders untappable on
    // device (the same reason DayViewSwitcher/StatusButton pin theirs).
    <IconMenu
      accessibilityLabel="Switch ritual step"
      sections={[{ options }]}
      style={{ width: theme.controls.md, height: theme.controls.md }}
    >
      <GlassIconButton
        accessibilityLabel="Switch ritual step"
        ionicon={STEP_ICONS[currentStep(state).id].ionicon}
        sfSymbol={STEP_ICONS[currentStep(state).id].sf}
      />
    </IconMenu>
  );
}
