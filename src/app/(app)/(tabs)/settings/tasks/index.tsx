import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isTaskTemplate, TTemplate } from "@/api/templates";
import { PickerField } from "@/components/PickerField";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { describeChecklist } from "@/components/TemplatePicker";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";
import { useTemplates } from "@/hooks/useTemplates";
import {
  ALARM_SOUNDS,
  isAlarmSupported,
  resolveAlarmSound,
} from "@/utils/alarms";
import { describeSchedule } from "@/utils/repeatSchedule";
import { useTheme } from "@/utils/theme";

export default function TasksScreen() {
  const theme = useTheme();
  const [templates] = useTemplates();
  const [{ alarmSound }, { updatePreferences }] = usePreferences();
  // Two kinds of row live in one table; the schedule is what tells them apart
  // (DEX-65). Both are edited by the same `tasks/[id]` screen.
  const taskTemplates = templates.filter(isTaskTemplate);
  const repeatTasks = templates.filter((t) => !isTaskTemplate(t));
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = useIsMultiPane();

  return (
    <SafeAreaView
      edges={twoPane ? ["bottom", "right"] : ["bottom", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: theme.spacing, gap: theme.spacing },
        ]}
      >
        {/* Alarms only ring on iOS, so the sound picker has nothing to offer
            elsewhere (DEX-72). */}
        {isAlarmSupported && (
          <View style={styles.section}>
            <SettingsSectionTitle>Alarms</SettingsSectionTitle>
            <PickerField
              label="Sound"
              options={ALARM_SOUNDS}
              // Resolved, not raw: the column is unconstrained text, and the
              // Picker needs a value matching one of its items or it renders
              // with nothing selected.
              selectedValue={resolveAlarmSound(alarmSound)}
              testID="alarm-sound-picker"
              onValueChange={(value) =>
                updatePreferences({ alarmSound: value })
              }
            />
          </View>
        )}

        <TemplateSection
          title="Repeat tasks"
          templates={repeatTasks}
          describe={(template) => describeSchedule(template.schedule)}
          emptyText="To repeat a task, open its menu and choose Repeat. Its schedule will show up here."
        />

        <TemplateSection
          title="Task templates"
          templates={taskTemplates}
          describe={describeChecklist}
          emptyText="Open a task's menu and choose Save as template to reuse it later."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

type TTemplateSectionProps = {
  title: string;
  templates: TTemplate[];
  /** The one-line summary under each row's title. */
  describe: (template: TTemplate) => string;
  emptyText: string;
};

/**
 * A titled list of template rows. Repeat tasks and task templates render
 * identically and open the same editor — only the section's copy and the line
 * under each title differ.
 */
function TemplateSection({
  title,
  templates,
  describe,
  emptyText,
}: TTemplateSectionProps) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={styles.section}>
      <SettingsSectionTitle>{title}</SettingsSectionTitle>
      {templates.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
          {emptyText}
        </Text>
      ) : (
        <View style={{ gap: theme.gap }}>
          {templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${template.title}`}
              onPress={() =>
                router.push({
                  pathname: "/settings/tasks/[id]",
                  params: { id: template.id },
                })
              }
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.borderRadius,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.title, { color: theme.colors.text }]}
              >
                {template.title || "Untitled task"}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.subtitle, { color: theme.colors.textSecondary }]}
              >
                {describe(template)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 4,
    padding: 16,
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  empty: {
    fontSize: 14,
    paddingVertical: 8,
  },
  section: {
    gap: 10,
  },
  subtitle: {
    fontSize: 13,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
});
