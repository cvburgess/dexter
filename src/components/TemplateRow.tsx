import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TTemplate } from "@/api/templates";
import { useTheme, withOpacity } from "@/utils/theme";

type TTemplateRowProps = {
  template: TTemplate;
  /** The line under the title — a schedule in settings, a step count in the picker. */
  description: string;
  onPress: () => void;
  /**
   * Omit where the row is a link rather than a choice: the outline and
   * checkmark only appear once a row can be selected.
   */
  selected?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * One template as a card. Shared by the Settings → Tasks lists and the
 * create-task modal's template picker, which show the same row and differ only
 * in their description line and whether the row can be selected.
 */
export function TemplateRow({
  template,
  description,
  onPress,
  selected,
  accessibilityLabel,
  testID,
}: TTemplateRowProps) {
  const theme = useTheme();
  const isSelectable = selected !== undefined;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={isSelectable ? { selected } : undefined}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius,
          // Matches the theme cards in Settings → Appearance.
          borderColor: selected
            ? theme.colors.primary
            : withOpacity(theme.colors.text, 0.1),
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
      testID={testID}
    >
      <View style={styles.body}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: theme.colors.text }]}
        >
          {template.title || "Untitled task"}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.description, { color: theme.colors.textSecondary }]}
        >
          {description}
        </Text>
      </View>
      {selected && (
        <SymbolView
          // Needs all three platforms: `expo-symbols` renders nothing for a
          // bare SF Symbol name off iOS, which would leave the picker's only
          // selection glyph missing on Android and web.
          name={{
            ios: "checkmark.circle.fill",
            android: "check_circle",
            web: "check_circle",
          }}
          size={18}
          tintColor={theme.colors.primary}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 4,
  },
  card: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  description: {
    fontSize: 13,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
});
