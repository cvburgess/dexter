import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TTemplate } from "@/api/templates";
import { useTheme } from "@/utils/theme";

import { Icon } from "./Icon";
import type { TIconName } from "./Icon.types";

type TTemplateRowProps = {
  template: TTemplate;
  /** The line under the title — a schedule in settings, a step count in the picker. */
  description: string;
  onPress: () => void;
  /** Omit where the row is a link, not a choice — outline/checkmark only
   * appear once a row can be selected. */
  selected?: boolean;
  /** Colors the description as an error — a repeat that can no longer fire. */
  isStalled?: boolean;
  /** A second tap target beside the row's own (e.g. a stalled repeat's
   * repair) — its presence restructures the row into two touch targets. */
  action?: {
    icon: TIconName;
    accessibilityLabel: string;
    onPress: () => void;
  };
  accessibilityLabel?: string;
  testID?: string;
};

// One template as a card, shared by Settings → Tasks and the create-task
// modal's picker — they differ only in description, selectability, and action.
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
      backgroundColor: theme.colors.surfaceSunken,
      borderRadius: theme.radii.md,
      // Matches the theme cards in Settings → Appearance.
      borderColor: selected ? theme.colors.primary : theme.colors.border,
      borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
      gap: theme.space.sm,
      padding: theme.space.md,
    },
  ];

  const body = (
    <View style={[styles.body, { gap: theme.space.xs }]}>
      <Text
        numberOfLines={1}
        style={[theme.fonts.title, { color: theme.colors.text }]}
      >
        {template.title || "Untitled task"}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          theme.fonts.subtitle,
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
    <Icon
      sf="checkmark.circle.fill"
      ionicon="checkmark-circle"
      color={theme.colors.primary}
    />
  ) : null;

  // Two tap targets need a plain View root — nesting Touchables renders a
  // <button> inside a <button> on web. Same as HabitRow.
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
          hitSlop={theme.space.sm}
          onPress={action.onPress}
          style={[styles.action, { width: theme.icons.md }]}
        >
          <Icon {...action.icon} color={theme.colors.primary} />
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
  },
  body: {
    flex: 1,
  },
  card: {
    alignItems: "center",
    flexDirection: "row",
  },
  main: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
  },
});
