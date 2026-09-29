import { StyleSheet, Text, View } from "react-native";

import { useTheme, withOpacity } from "@/utils/theme";

type TColumnChipProps = {
  title: string;
  subtitle: string;
  accessibilityLabel: string;
  /** Inverts the chip — Week's today column. */
  highlighted?: boolean;
  testID?: string;
};

// The bordered heading atop a kanban column — Week's days (DEX-96) and the
// Lists tab's lists (DEX-221). Not a button: every column is already on screen.
export function ColumnChip({
  title,
  subtitle,
  accessibilityLabel,
  highlighted = false,
  testID,
}: TColumnChipProps) {
  const theme = useTheme();
  const chipColor = highlighted ? theme.colors.background : theme.colors.text;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessible
      style={[
        styles.chip,
        {
          backgroundColor: highlighted
            ? withOpacity(theme.colors.text, 0.8)
            : "transparent",
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          // `xs` separates a label from the thing it labels (docs/design.md).
          gap: theme.space.xs,
          // The height *is* the vertical padding — lines center in it.
          // `lg` cleared the title-sized name; `xs` read as cramped.
          height: theme.controls.md + theme.space.lg,
          paddingHorizontal: theme.space.sm,
        },
      ]}
      testID={testID}
    >
      <Text numberOfLines={1} style={[theme.fonts.title, { color: chipColor }]}>
        {title}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          theme.fonts.subtitle,
          styles.chipSubtitle,
          { color: chipColor },
        ]}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full column width via stretch; height pinned inline and not `flex`, or
  // growing would stretch it down the column instead of across it.
  chip: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "hidden",
  },
  // Dimmed so the pair reads as one label rather than two competing lines.
  chipSubtitle: {
    opacity: 0.8,
  },
});
