import { GlassIconButton } from "@/components/GlassIconButton";
import type { TIconName } from "@/components/Icon.types";
import { otherMode, type TRitualMode } from "@/utils/ritualSteps";

/**
 * Icon and label for each ritual, shared by the small-screen header and the
 * large-screen toolbar so both surfaces name the two halves of the day the same
 * way — the same reason `DayViewSwitcher` owns `VIEW_META`.
 */
export const MODE_META: Record<
  TRitualMode,
  { label: string; icon: TIconName }
> = {
  am: {
    label: "morning",
    icon: { sf: "sun.max", ionicon: "sunny-outline" },
  },
  pm: {
    label: "evening",
    icon: { sf: "moon", ionicon: "moon-outline" },
  },
};

type TRitualModeButtonProps = {
  mode: TRitualMode;
  onPress: () => void;
};

/**
 * The AM/PM switch — one round button showing the ritual you are in, which
 * flips to the other when pressed.
 *
 * `active={false}` rather than omitted, and it is doing two jobs. Neither half
 * of the day is the "on" state of a toggle, so a primary tint would read as a
 * setting rather than a position — the icon carries the state (sun for the
 * morning ritual, moon for the evening one) while the accessibility label
 * carries the *action*, since that is what a press does. And omitting the prop
 * is not the same as untinting it: `GlassIconButton`'s platform default is
 * primary on iOS and text elsewhere, so leaving it off drew this button in two
 * different colors depending on the device.
 */
export function RitualModeButton({ mode, onPress }: TRitualModeButtonProps) {
  const { icon } = MODE_META[mode];

  return (
    <GlassIconButton
      accessibilityLabel={`Switch to the ${MODE_META[otherMode(mode)].label} ritual`}
      active={false}
      ionicon={icon.ionicon}
      onPress={onPress}
      sfSymbol={icon.sf}
    />
  );
}
