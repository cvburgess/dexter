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
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import {
  ALARM_SOUNDS,
  isAlarmSupported,
  resolveAlarmSound,
} from "@/utils/alarms";
import {
  FOCUS_BLOCK_LENGTHS,
  resolveFocusBlockMinutes,
} from "@/utils/focusBlocks";
import { describeSchedule } from "@/utils/repeatSchedule";
import {
  EDGES_SINGLE_PANE,
  EDGES_TWO_PANE,
} from "@/utils/settingsSafeAreaEdges";
import { isCompletionStatus } from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

/** What a repeat with nothing left to fire from says instead of its cadence. */
const STALLED_DESCRIPTION = "Not recurring — no open task to repeat from";

const PLAY_ICON = { sf: "play.fill", ionicon: "play" } as const;

export default function TasksScreen() {
  const theme = useTheme();
  const [templates, { createNextOccurrence }] = useTemplates();
  const [tasks, { isLoading: isLoadingTasks }] = useTasks();
  const [{ alarmSound, focusBlockMinutes }, { updatePreferences }] =
    usePreferences();
  // Two kinds of row live in one table; the schedule is what tells them apart
  // (DEX-65). Both are edited by the same `tasks/[id]` screen.
  const taskTemplates = templates.filter(isTaskTemplate);
  const repeatTasks = templates.filter(isRepeatTask);

  // A repeat fires by completing its one open task, so none means stalled.
  // Unloaded is "unknown" — useTasks' [] placeholder isn't "empty".
  const isStalled = (template: TTemplate) =>
    !isLoadingTasks &&
    !tasks.some(
      (task) =>
        task.templateId === template.id && !isCompletionStatus(task.status),
    );
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = useIsLargeDevice();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      edges={twoPane ? EDGES_TWO_PANE : EDGES_SINGLE_PANE}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        // Edges omit `bottom`; the content padding lets the last row clear
        // the translucent tab bar (DEX-91).
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.space.md,
            paddingBottom: theme.space.md + insets.bottom,
            gap: theme.space.sm,
          },
        ]}
      >
        {/* Alarms only ring on iOS, so the sound picker has nothing to offer
            elsewhere (DEX-72). */}
        {isAlarmSupported && (
          <View style={{ gap: theme.space.sm }}>
            <SettingsSectionTitle>Alarms</SettingsSectionTitle>
            {/* Card lives here, not in PickerField: this is the only picker
                that's a standalone settings input, not a form row. */}
            <View
              style={{
                backgroundColor: theme.colors.surfaceSunken,
                borderRadius: theme.radii.md,
                padding: theme.space.md,
              }}
            >
              <PickerField
                label="Sound"
                options={ALARM_SOUNDS}
                // Resolved, not raw: the column is unconstrained text and an
                // unmatched value renders the Picker with nothing selected.
                selectedValue={resolveAlarmSound(alarmSound)}
                testID="alarm-sound-picker"
                onValueChange={(value) =>
                  updatePreferences({ alarmSound: value })
                }
              />
            </View>
          </View>
        )}

        <View style={{ gap: theme.space.sm }}>
          <SettingsSectionTitle>Focus blocks</SettingsSectionTitle>
          {/* Same card-at-the-call-site reasoning as the alarm sound above. */}
          <View
            style={{
              backgroundColor: theme.colors.surfaceSunken,
              borderRadius: theme.radii.md,
              padding: theme.space.md,
            }}
          >
            <PickerField
              label="Length"
              options={FOCUS_BLOCK_LENGTHS}
              // No per-block choice keeps starting one a single tap (DEX-49);
              // resolved for the same unconstrained-column reason as the sound.
              selectedValue={String(
                resolveFocusBlockMinutes(focusBlockMinutes),
              )}
              testID="focus-block-length-picker"
              onValueChange={(value) =>
                updatePreferences({ focusBlockMinutes: Number(value) })
              }
            />
          </View>
        </View>

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
  /** Repeat tasks only — how to spot a stalled one and fix it. */
  repair?: {
    isStalled: (template: TTemplate) => boolean;
    onPress: (template: TTemplate) => void;
  };
};

// Repeat tasks and task templates render identically; only the copy, the
// line under each title, and the repair action differ.
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
    <View style={{ gap: theme.space.sm }}>
      <SettingsSectionTitle>{title}</SettingsSectionTitle>
      {templates.length === 0 ? (
        <Text
          style={[
            theme.fonts.body,
            { paddingVertical: theme.space.sm },
            { color: theme.colors.textSecondary },
          ]}
        >
          {emptyText}
        </Text>
      ) : (
        <View style={{ gap: theme.space.sm }}>
          {templates.map((template) => {
            // Stalled replaces the cadence rather than sitting beside it —
            // "Every day" is what the row is failing to do.
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
});
