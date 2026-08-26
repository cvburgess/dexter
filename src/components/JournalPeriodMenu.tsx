import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/Icon";
import { IconMenu, TIconMenuSection } from "@/components/IconMenu";
import { MODE_META } from "@/components/RitualModeButton";
import type { TRitualMode } from "@/utils/ritualSteps";
import { useTheme } from "@/utils/theme";

type TJournalPeriodMenuProps = {
  /** The ritual this prompt currently belongs to. */
  period: TRitualMode;
  /** Named in the trigger's accessibility label, so a screen reader can tell
   * one row's control from the next. 1-based, matching the field beside it. */
  promptNumber: number;
  onChange: (period: TRitualMode) => void;
};

/**
 * Which ritual asks a journal prompt (DEX-151), as the leading control on its
 * row in Settings → Ritual.
 *
 * The row shape is the one Lists and Habits already use — a square tap target
 * in front of a flexed field — with the emoji sheet swapped for a menu, since
 * this picks between two known values rather than anything at all. The tile
 * borrows the field's own surface and radius so the pair reads as one control.
 *
 * Icons and words come from `MODE_META`, the ritual mode button's own table, so
 * the two surfaces cannot come to name the halves of the day differently.
 */
export function JournalPeriodMenu({
  period,
  promptNumber,
  onChange,
}: TJournalPeriodMenuProps) {
  const theme = useTheme();

  // The native menu host must be pinned to the trigger's exact size — left to
  // flex it reports zero height while sizing and collapses the row (the same
  // note `StatusButton` and `ListButton` carry). A hair taller than
  // `controls.md`, matching the Lists/Habits tile, so it stands level with the
  // field beside it, whose height is `fonts.body` inside `space.md` of padding.
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
 * The menu's two rows, exported so the selection logic is testable: the
 * `MenuView` test double renders only its trigger, so a section builder is the
 * seam every icon menu in this app is covered through (see `jest.setup.js` and
 * `getListSections`).
 */
export const journalPeriodSections = (
  period: TRitualMode,
  onChange: (period: TRitualMode) => void,
): TIconMenuSection[] => [
  {
    options: (["am", "pm"] as const).map((option) => ({
      id: option,
      // `MODE_META`'s labels are mid-sentence fragments ("Switch to the morning
      // ritual"), so capitalize rather than spelling the two words out again
      // here and letting them drift from the ritual's own button.
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
