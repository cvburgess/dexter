import { useNavigation, useRouter } from "expo-router";
import { useLayoutEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HabitRow } from "@/components/HabitRow";
import { HeaderAddButton } from "@/components/HeaderAddButton";
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

  // A "+" in the header opens the create modal (mirrors New Task), but only when
  // habit tracking is on — otherwise there's no list to add to. Re-wired on
  // every render so the handler and `enableHabits` gate stay current.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderAddButton
          accessibilityLabel="New habit"
          visible={preferences.enableHabits}
          onPress={() =>
            router.push({
              pathname: "/settings/habits/[id]",
              params: { id: "new" },
            })
          }
          testID="new-habit-button"
        />
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
          <View style={styles.section}>
            <SettingsSectionTitle>Habits</SettingsSectionTitle>
            {habits.length === 0 ? (
              <Text
                style={[styles.empty, { color: theme.colors.textSecondary }]}
              >
                Tap ＋ to create your first habit.
              </Text>
            ) : (
              <View style={styles.list}>
                {habits.map((habit) => (
                  <View
                    key={habit.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: theme.colors.card,
                        borderRadius: theme.borderRadius,
                      },
                    ]}
                  >
                    <HabitRow habit={habit} updateHabit={updateHabit} />
                  </View>
                ))}
              </View>
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
  card: {
    overflow: "hidden",
    paddingHorizontal: 16,
  },
  empty: {
    fontSize: 14,
    paddingVertical: 8,
  },
  list: {
    gap: 8,
  },
  section: {
    gap: 10,
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
