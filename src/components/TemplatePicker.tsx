import { StyleSheet, Text, View } from "react-native";

import { describeChecklist, TTemplate } from "@/api/templates";
import { TemplateRow } from "@/components/TemplateRow";
import { useTheme } from "@/utils/theme";

type TTemplatePickerProps = {
  templates: TTemplate[];
  selectedId: string | null;
  onSelect: (template: TTemplate) => void;
  /** While true the list is unknown, not empty — see the empty state below. */
  isLoading?: boolean;
};

/**
 * The task templates a new task can start from. Selection outlines the chosen
 * card the way the appearance screen's theme picker does (DEX-65); the caller
 * decides what selecting means.
 */
export function TemplatePicker({
  templates,
  selectedId,
  onSelect,
  isLoading,
}: TTemplatePickerProps) {
  const theme = useTheme();

  // "You have none" is a different claim from "these haven't arrived yet", and
  // the empty copy tells the user to go and make one — bad advice to give
  // someone whose templates are still loading.
  if (isLoading) return null;

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
      {templates.map((template) => (
        <TemplateRow
          key={template.id}
          template={template}
          description={describeChecklist(template)}
          selected={template.id === selectedId}
          onPress={() => onSelect(template)}
          testID={`template-option-${template.id}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: 14,
    paddingVertical: 8,
  },
});
