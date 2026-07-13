import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { useTemplates } from "@/hooks/useTemplates";
import { describeSchedule } from "@/utils/repeatSchedule";
import { useTheme } from "@/utils/theme";

export default function TasksScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [templates] = useTemplates();
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
