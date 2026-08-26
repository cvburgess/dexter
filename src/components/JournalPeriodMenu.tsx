import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/Icon";
import { IconMenu, TIconMenuSection } from "@/components/IconMenu";
import { MODE_META } from "@/components/RitualModeButton";
import type { TRitualMode } from "@/utils/ritualSteps";
import { useTheme } from "@/utils/theme";

type TJournalPeriodMenuProps = {
  /** The ritual this prompt currently belongs to. */
  period: TRitualMode;
  /** 1-based, matching the field beside it; names the trigger for a screen reader. */
  promptNumber: number;
  onChange: (period: TRitualMode) => void;
};

/**
 * Which ritual asks a journal prompt (DEX-151), as the leading control on its row.
 * Icons and words come from `MODE_META`, so this and the mode button can't drift.
 */
export function JournalPeriodMenu({
  period,
  promptNumber,
  onChange,
}: TJournalPeriodMenuProps) {
  const theme = useTheme();

  // Pinned to the trigger's exact size: left to flex, the native menu host reports
  // zero height and collapses the row (see `StatusButton`). Matches the field.
  const box = {
    height: theme.controls.md + theme.space.sm,
    width: theme.controls.md + theme.space.sm,
  };

  return (
    <IconMenu
      accessibilityLabel={`Journal prompt ${promptNumber} ritual: ${MODE_META[period].label}`}
      menuTitle="Ritual"
      sections={journalPeriodSections(period, onChange)}
      style={box}
    >
      <View
        style={[
          styles.tile,
          box,
          {
            backgroundColor: theme.colors.surfaceSunken,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <Icon {...MODE_META[period].icon} color={theme.colors.textSecondary} />
      </View>
    </IconMenu>
  );
}

/**
 * Exported so the selection logic is testable: the `MenuView` double renders only
 * the trigger, so a section builder is how every icon menu here is covered.
 */
export const journalPeriodSections = (
  period: TRitualMode,
  onChange: (period: TRitualMode) => void,
): TIconMenuSection[] => [
  {
    options: (["am", "pm"] as const).map((option) => ({
      id: option,
      // `MODE_META`'s labels are mid-sentence fragments, so capitalize rather than
      // spelling the words out again and letting them drift.
      title:
        MODE_META[option].label.charAt(0).toUpperCase() +
        MODE_META[option].label.slice(1),
      icon: MODE_META[option].icon,
      isSelected: option === period,
      onSelect: () => onChange(option),
    })),
  },
];

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
  },
});
