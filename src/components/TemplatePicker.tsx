import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TTemplate } from "@/api/templates";
import { useTheme, withOpacity } from "@/utils/theme";

type TTemplatePickerProps = {
  templates: TTemplate[];
  selectedId: string | null;
  onSelect: (template: TTemplate) => void;
};

/** "3 steps" — the only thing worth saying about a template in a list row. */
export const describeChecklist = (template: TTemplate): string => {
  const count = template.subtasks.length;
  if (count === 0) return "No checklist";
  return count === 1 ? "1 step" : `${count} steps`;
};

/**
 * The task templates a new task can start from, as a list of cards. Selection
 * outlines the chosen card the way the appearance screen's theme picker does
 * (DEX-65); the caller decides what selecting means.
 */
export function TemplatePicker({
  templates,
  selectedId,
  onSelect,
}: TTemplatePickerProps) {
  const theme = useTheme();

  if (templates.length === 0) {
    return (
      <Text
        style={[styles.empty, { color: theme.colors.textSecondary }]}
        testID="template-picker-empty"
      >
        No templates yet. Open a task&apos;s menu and choose Save as template to
        reuse it later.
      </Text>
    );
  }

  return (
    <View style={{ gap: theme.gap }}>
      {templates.map((template) => {
        const selected = template.id === selectedId;
        return (
          <TouchableOpacity
            key={template.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(template)}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderRadius: theme.borderRadius,
                borderColor: selected
                  ? theme.colors.primary
                  : withOpacity(theme.colors.text, 0.1),
                borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
              },
            ]}
            testID={`template-option-${template.id}`}
          >
            <View style={styles.body}>
              <Text
                numberOfLines={1}
                style={[styles.title, { color: theme.colors.text }]}
              >
                {template.title || "Untitled template"}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.subtitle, { color: theme.colors.textSecondary }]}
              >
                {describeChecklist(template)}
              </Text>
            </View>
            {selected && (
              <SymbolView
                name="checkmark.circle.fill"
                size={18}
                tintColor={theme.colors.primary}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
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
  empty: {
    fontSize: 14,
    paddingVertical: 8,
  },
  subtitle: {
    fontSize: 13,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
});
