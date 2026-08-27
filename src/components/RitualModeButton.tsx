import { GlassIconButton } from "@/components/GlassIconButton";
import type { TIconName } from "@/components/Icon.types";
import { otherMode, type TRitualMode } from "@/utils/ritualSteps";

// Shared by the small-screen header and large-screen toolbar so both name
// the two halves of the day the same way (DayViewSwitcher's VIEW_META, too).
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

// `active={false}` explicitly, not omitted: neither half of the day is a
// toggle's "on" state (the icon carries that), and omitting the prop drew
// this button in two different colors by platform (GlassIconButton's default).
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
