import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PickerField } from "@/components/PickerField";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
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
  const router = useRouter();
  const [templates] = useTemplates();
  const [{ alarmSound }, { updatePreferences }] = usePreferences();
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

        <View style={styles.section}>
          <SettingsSectionTitle>Repeating Tasks</SettingsSectionTitle>
          {templates.length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
              To repeat a task, open its menu and choose Repeat. Its schedule
              will show up here.
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
                    style={[
                      styles.subtitle,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {describeSchedule(template.schedule)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
