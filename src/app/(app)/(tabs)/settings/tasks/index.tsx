import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  describeChecklist,
  isRepeatTask,
  isTaskTemplate,
  TTemplate,
} from "@/api/templates";
import { PickerField } from "@/components/PickerField";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { TemplateRow } from "@/components/TemplateRow";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import {
  ALARM_SOUNDS,
  isAlarmSupported,
  resolveAlarmSound,
} from "@/utils/alarms";
import { describeSchedule } from "@/utils/repeatSchedule";
import {
  EDGES_SINGLE_PANE,
  EDGES_TWO_PANE,
} from "@/utils/settingsSafeAreaEdges";
import { isCompletionStatus } from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

/** What a repeat with nothing left to fire from says instead of its cadence. */
const STALLED_DESCRIPTION = "Not recurring — no open task to repeat from";

const PLAY_ICON = {
  ios: "play.fill",
  android: "play_arrow",
  web: "play_arrow",
} as const;

export default function TasksScreen() {
  const theme = useTheme();
  const [templates, { createNextOccurrence }] = useTemplates();
  const [tasks] = useTasks();
  const [{ alarmSound }, { updatePreferences }] = usePreferences();
  // Two kinds of row live in one table; the schedule is what tells them apart
  // (DEX-65). Both are edited by the same `tasks/[id]` screen.
  const taskTemplates = templates.filter(isTaskTemplate);
  const repeatTasks = templates.filter(isRepeatTask);

  // A repeat has exactly one open task, and fires by *completing* it — so one
  // with none can never fire again and is stalled, not merely idle. Answered
  // from the cache: the canonical query already holds every incomplete task
  // regardless of date (`useTasks`), so no extra query is needed.
  const isStalled = (template: TTemplate) =>
    !tasks.some(
      (task) =>
        task.templateId === template.id && !isCompletionStatus(task.status),
    );
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = useIsMultiPane();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      edges={twoPane ? EDGES_TWO_PANE : EDGES_SINGLE_PANE}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        // The edges above omit `bottom` so content scrolls under the
        // translucent tab bar; adding the inset to the content's own bottom
        // padding is what lets the last row clear it (DEX-91).
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.spacing,
            paddingBottom: theme.spacing + insets.bottom,
            gap: theme.spacing,
          },
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
          repair={{ isStalled, onPress: createNextOccurrence }}
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
  /**
   * Repeat tasks only: how to spot one that has run dry, and how to fix it. A
   * task template is stamped out on demand and has nothing to stall.
   */
  repair?: {
    isStalled: (template: TTemplate) => boolean;
    onPress: (template: TTemplate) => void;
  };
};

/**
 * A titled list of template rows. Repeat tasks and task templates render
 * identically and open the same editor — only the section's copy, the line
 * under each title, and the repair action differ.
 */
function TemplateSection({
  title,
  templates,
  describe,
  emptyText,
  repair,
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
          {templates.map((template) => {
            // The stalled state replaces the cadence rather than sitting beside
            // it: "Every day" is what the row is failing to do, so restating it
            // alongside the warning would read as a contradiction.
            const stalled = repair?.isStalled(template) ?? false;

            return (
              <TemplateRow
                key={template.id}
                template={template}
                description={stalled ? STALLED_DESCRIPTION : describe(template)}
                isStalled={stalled}
                action={
                  stalled && repair
                    ? {
                        icon: PLAY_ICON,
                        accessibilityLabel: `Create next ${template.title}`,
                        onPress: () => repair.onPress(template),
                      }
                    : undefined
                }
                accessibilityLabel={`Edit ${template.title}`}
                onPress={() =>
                  router.push({
                    pathname: "/settings/tasks/[id]",
                    params: { id: template.id },
                  })
                }
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
