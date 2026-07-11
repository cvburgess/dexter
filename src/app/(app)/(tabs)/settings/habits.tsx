import Ionicons from "@react-native-vector-icons/ionicons";
import { useNavigation, useRouter } from "expo-router";
import { useLayoutEffect } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HabitRow } from "@/components/HabitRow";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { useHabits } from "@/hooks/useHabits";
import { usePreferences } from "@/hooks/usePreferences";
import { SETTINGS_TWO_PANE_MIN_WIDTH } from "@/utils/settingsItems";
import { useTheme, withOpacity } from "@/utils/theme";

export default function HabitsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const [habits, { updateHabit }] = useHabits();
  const [preferences, { updatePreferences }] = usePreferences();
  const { width } = useWindowDimensions();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = width >= SETTINGS_TWO_PANE_MIN_WIDTH;

  // A "+" in the header opens the create modal (mirrors New Task). Re-wired on
  // every render so the handler closes over the latest router.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="New habit"
          onPress={() => router.push("/habit")}
          style={Platform.OS === "web" ? styles.headerButtonWeb : undefined}
        >
          <Ionicons color={theme.colors.primary} name="add" size={28} />
        </TouchableOpacity>
      ),
    });
  });

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
        <View
          style={[
            styles.toggle,
            {
              backgroundColor: theme.colors.card,
              borderRadius: theme.borderRadius,
            },
          ]}
        >
          <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>
            Habit Tracking
          </Text>
          <Switch
            accessibilityLabel="Habit Tracking"
            value={preferences.enableHabits}
            onValueChange={(enableHabits) =>
              updatePreferences({ enableHabits })
            }
            trackColor={{
              true: theme.colors.primary,
              false: withOpacity(theme.colors.text, 0.2),
            }}
          />
        </View>

        {preferences.enableHabits && (
          <View
            style={[
              styles.list,
              {
                backgroundColor: theme.colors.card,
                borderRadius: theme.borderRadius,
              },
            ]}
          >
            <SettingsSectionTitle>Habits</SettingsSectionTitle>
            {habits.length === 0 ? (
              <Text
                style={[styles.empty, { color: theme.colors.textSecondary }]}
              >
                Tap ＋ to create your first habit.
              </Text>
            ) : (
              habits.map((habit, index) => (
                <View key={habit.id}>
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
                  <HabitRow habit={habit} updateHabit={updateHabit} />
                </View>
              ))
            )}
          </View>
        )}
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
  headerButtonWeb: {
    marginRight: 20,
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggle: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
});
