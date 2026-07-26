import { StyleSheet, Text, View } from "react-native";

import { ETaskPriority, ETaskStatus } from "@/api/tasks";
import { Theme, useTheme, withOpacity } from "@/utils/theme";

import { IconMenu, TIconMenuSection } from "./IconMenu";

type TStatusButtonProps = {
  status: ETaskStatus;
  contentColor: string;
  onChangeStatus: (status: ETaskStatus) => void;
  /** Diameter in px. Subtask rows use 24 so they read as subordinate to the parent's 32. */
  size?: number;
  accessibilityLabel?: string;
  /** When false the glyph still renders but no menu opens — and no native menu host is mounted. */
  interactive?: boolean;
};

const DEFAULT_SIZE = 32;

export function StatusButton({
  status,
  contentColor,
  onChangeStatus,
  size = DEFAULT_SIZE,
  accessibilityLabel = "Status",
  interactive = true,
}: TStatusButtonProps) {
  const theme = useTheme();
  const sections = getStatusSections(onChangeStatus, theme.colors);

  const glyph = (
    <View
      style={[
        styles.button,
        {
          borderColor: withOpacity(contentColor, 0.25),
          height: size,
          width: size,
        },
      ]}
    >
      <Text style={{ color: contentColor, fontSize: size / 2 }}>
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
      style={{ height: size, width: size }}
    >
      {glyph}
    </IconMenu>
  );
}

/**
 * Tints each status's menu icon, reusing the same tokens the priority icons draw
 * from: yellow/blue are the daisyUI `warning`/`info` slots of the `priority`
 * array, and green/red are the dedicated `success`/`error` tokens. To Do is left
 * untinted so it inherits the menu's own text color — an open task is the neutral
 * default, and giving it an accent would imply a state it doesn't have.
 *
 * Passing `colors` in (rather than reading a theme here) keeps this a pure
 * function of its arguments, which is what lets the test call it directly.
 */
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
          icon: { ios: "circle", android: "circle", web: "circle" },
        },
        {
          id: "in-progress",
          title: "In Progress",
          status: ETaskStatus.IN_PROGRESS,
          icon: {
            ios: "circle.lefthalf.filled",
            android: "contrast",
            web: "contrast",
          },
        },
        {
          id: "done",
          title: "Done",
          status: ETaskStatus.DONE,
          icon: { ios: "checkmark", android: "check", web: "check" },
        },
        {
          id: "wont-do",
          title: "Won't Do",
          status: ETaskStatus.WONT_DO,
          icon: { ios: "xmark", android: "close", web: "close" },
        },
        {
          id: "delegated",
          title: "Delegated",
          status: ETaskStatus.DELEGATED,
          icon: {
            ios: "arrow.right",
            android: "arrow_forward",
            web: "arrow_forward",
          },
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

/**
 * The trigger draws a text character rather than the menu's `SymbolView` icon
 * (which would tint fine — see `PriorityControl`): the typographic circle is the
 * task affordance itself, and nesting an SF `circle` inside the bordered circle
 * would double it up. So each status carries two glyphs — the symbol name in
 * `getStatusSections` and its text counterpart here. Delegated pairs the arrow
 * symbol with "→" so the menu row and the trigger read as the same mark.
 *
 * Keyed as a `Record` rather than a switch with a `default` so that adding a
 * status without a glyph is a type error instead of a silent fallback to "○".
 * The `??` at the call site is for values the *type* can't police: `tasks.status`
 * is an unconstrained smallint and the row is an unchecked cast, so an
 * out-of-enum value renders "○" rather than an empty button.
 */
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
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
});
