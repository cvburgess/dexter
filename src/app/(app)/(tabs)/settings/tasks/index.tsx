import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { useTemplates } from "@/hooks/useTemplates";
import { describeSchedule } from "@/utils/repeatSchedule";
import { SETTINGS_TWO_PANE_MIN_WIDTH } from "@/utils/settingsItems";
import { useTheme, withOpacity } from "@/utils/theme";

export default function TasksScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [templates] = useTemplates();
  const { width } = useWindowDimensions();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = width >= SETTINGS_TWO_PANE_MIN_WIDTH;

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
        <View style={styles.section}>
          <SettingsSectionTitle>Repeating Tasks</SettingsSectionTitle>
          {templates.length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
              To repeat a task, open its menu and choose Repeat. Its schedule
              will show up here.
            </Text>
          ) : (
            <View>
              {templates.map((template, index) => (
                <View key={template.id}>
                  {index > 0 && (
                    <View
                      style={[
                        styles.divider,
                        {
                          backgroundColor: withOpacity(theme.colors.text, 0.08),
                        },
                      ]}
                    />
                  )}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${template.title}`}
                    onPress={() =>
                      router.push({
                        pathname: "/settings/tasks/[id]",
                        params: { id: template.id },
                      })
                    }
                    style={styles.row}
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
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  empty: {
    fontSize: 14,
    paddingVertical: 8,
  },
  row: {
    gap: 4,
    paddingVertical: 12,
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
