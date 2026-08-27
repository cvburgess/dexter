import { Text, View } from "react-native";

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

  // "You have none" is a different claim from "these haven't arrived yet" —
  // bad advice to someone whose templates are still loading.
  if (isLoading) return null;

  if (templates.length === 0) {
    return (
      <Text
        style={[
          theme.fonts.body,
          {
            color: theme.colors.textSecondary,
            paddingVertical: theme.space.sm,
          },
        ]}
        testID="template-picker-empty"
      >
        No templates yet. Open a task&apos;s menu and choose Save as template to
        reuse it later.
      </Text>
    );
  }

  return (
    <View style={{ gap: theme.space.sm }}>
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
