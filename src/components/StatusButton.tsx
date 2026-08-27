import { StyleSheet, Text, View } from "react-native";

import { ETaskPriority, ETaskStatus } from "@/api/tasks";
import { Theme, useTheme, withOpacity } from "@/utils/theme";

import { IconMenu, TIconMenuSection } from "./IconMenu";

type TStatusButtonProps = {
  status: ETaskStatus;
  contentColor: string;
  onChangeStatus: (status: ETaskStatus) => void;
  accessibilityLabel?: string;
  /** When false the glyph still renders but no menu opens — and no native menu host is mounted. */
  interactive?: boolean;
};

export function StatusButton({
  status,
  contentColor,
  onChangeStatus,
  accessibilityLabel = "Status",
  interactive = true,
}: TStatusButtonProps) {
  const theme = useTheme();
  // Since DEX-153 this is only ever a task's status circle — subtasks toggle a
  // `SubtaskCheck` instead — so the diameter is the token, not a prop.
  const diameter = theme.controls.sm;
  const sections = getStatusSections(onChangeStatus, theme.colors);

  const glyph = (
    <View
      style={[
        styles.button,
        {
          // From the card's content color, not colors.border — a neutral
          // hairline washes out on the priority fill.
          borderColor: withOpacity(contentColor, 0.25),
          borderRadius: theme.radii.full,
          height: diameter,
          width: diameter,
        },
      ]}
    >
      <Text style={{ color: contentColor, fontSize: diameter / 2 }}>
        {GLYPHS[status] ?? GLYPHS[ETaskStatus.TODO]}
      </Text>
    </View>
  );

  if (!interactive) return glyph;

  return (
    <IconMenu
      accessibilityLabel={accessibilityLabel}
      menuTitle="Status"
      sections={sections}
      // The native menu host must be pinned to the trigger's exact size — left
      // to flex it reports 0 height while sizing and collapses the row.
      style={{ height: diameter, width: diameter }}
    >
      {glyph}
    </IconMenu>
  );
}

// Reuses the priority icons' own tokens. To Do stays untinted — an open task
// is the neutral default, and `colors` is a param so tests can call this pure.
const iconColorForStatus = (
  status: ETaskStatus,
  colors: Theme["colors"],
): string | undefined => {
  switch (status) {
    case ETaskStatus.IN_PROGRESS:
      return colors.priority[ETaskPriority.IMPORTANT_AND_URGENT];
    case ETaskStatus.DONE:
      return colors.success;
    case ETaskStatus.WONT_DO:
      return colors.error;
    case ETaskStatus.DELEGATED:
      return colors.priority[ETaskPriority.IMPORTANT];
    case ETaskStatus.TODO:
    default:
      return undefined;
  }
};

export const getStatusSections = (
  onChangeStatus: (status: ETaskStatus) => void,
  colors?: Theme["colors"],
): TIconMenuSection[] => [
  {
    options: (
      [
        {
          id: "todo",
          title: "To Do",
          status: ETaskStatus.TODO,
          icon: { sf: "circle", ionicon: "ellipse-outline" },
        },
        {
          id: "in-progress",
          title: "In Progress",
          status: ETaskStatus.IN_PROGRESS,
          icon: { sf: "circle.lefthalf.filled", ionicon: "contrast-outline" },
        },
        {
          id: "done",
          title: "Done",
          status: ETaskStatus.DONE,
          icon: { sf: "checkmark", ionicon: "checkmark" },
        },
        {
          id: "wont-do",
          title: "Won't Do",
          status: ETaskStatus.WONT_DO,
          icon: { sf: "xmark", ionicon: "close" },
        },
        {
          id: "delegated",
          title: "Delegated",
          status: ETaskStatus.DELEGATED,
          icon: { sf: "arrow.right", ionicon: "arrow-forward" },
        },
      ] as const
    ).map(({ status: optionStatus, ...option }) => ({
      ...option,
      iconColor: colors ? iconColorForStatus(optionStatus, colors) : undefined,
      // No isSelected: the icons say it all, and the trigger glyph already
      // reflects the current status — skip the menu checkmark.
      onSelect: () => onChangeStatus(optionStatus),
    })),
  },
];

// A text glyph, not the menu's SF `circle` icon — nesting one inside the
// bordered trigger circle would double it. `Record`, not a switch, so a
// missing status is a type error; the call-site `??` covers an unchecked-cast out-of-enum value.
const GLYPHS: Record<ETaskStatus, string> = {
  [ETaskStatus.TODO]: "○",
  [ETaskStatus.IN_PROGRESS]: "◐",
  [ETaskStatus.DONE]: "✓",
  [ETaskStatus.WONT_DO]: "✕",
  [ETaskStatus.DELEGATED]: "→",
};

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
  },
});
