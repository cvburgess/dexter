import { SymbolView, SymbolViewProps } from "expo-symbols";
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
  /** Colors the description as an error — a repeat that can no longer fire. */
  isStalled?: boolean;
  /**
   * A second tap target beside the row's own, e.g. the one-tap repair on a
   * stalled repeat. Its presence restructures the row — see the comment below.
   */
  action?: {
    icon: SymbolViewProps["name"];
    accessibilityLabel: string;
    onPress: () => void;
  };
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * One template as a card. Shared by the Settings → Tasks lists and the
 * create-task modal's template picker, which show the same row and differ only
 * in their description line, whether the row can be selected, and whether it
 * carries an inline action.
 */
export function TemplateRow({
  template,
  description,
  onPress,
  selected,
  isStalled,
  action,
  accessibilityLabel,
  testID,
}: TTemplateRowProps) {
  const theme = useTheme();
  const isSelectable = selected !== undefined;

  const cardStyle = [
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
  ];

  const body = (
    <View style={styles.body}>
      <Text
        numberOfLines={1}
        style={[styles.title, { color: theme.colors.text }]}
      >
        {template.title || "Untitled task"}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          styles.description,
          {
            color: isStalled ? theme.colors.error : theme.colors.textSecondary,
          },
        ]}
      >
        {description}
      </Text>
    </View>
  );

  const check = selected ? (
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
  ) : null;

  // With an action the card hosts two separate tap targets, so its root has to
  // be a plain View: nesting one Touchable inside another renders as a <button>
  // inside a <button> on web, which is invalid DOM. Same arrangement as
  // `HabitRow`.
  if (action) {
    return (
      <View style={cardStyle} testID={testID}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={isSelectable ? { selected } : undefined}
          onPress={onPress}
          style={styles.main}
        >
          {body}
        </TouchableOpacity>
        {check}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          hitSlop={8}
          onPress={action.onPress}
          style={styles.action}
        >
          <SymbolView
            name={action.icon}
            size={18}
            tintColor={theme.colors.primary}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={isSelectable ? { selected } : undefined}
      onPress={onPress}
      style={cardStyle}
      testID={testID}
    >
      {body}
      {check}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    justifyContent: "center",
    width: 24,
  },
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
  main: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
});
