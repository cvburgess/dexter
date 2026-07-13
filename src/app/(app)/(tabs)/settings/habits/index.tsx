import { useNavigation, useRouter } from "expo-router";
import { useLayoutEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HabitRow } from "@/components/HabitRow";
import { HeaderAddButton } from "@/components/HeaderAddButton";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { SettingsToggleCard } from "@/components/SettingsToggleCard";
import { useHabits } from "@/hooks/useHabits";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/utils/theme";

export default function HabitsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const [habits, { updateHabit }] = useHabits();
  const [preferences, { updatePreferences }] = usePreferences();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = useIsMultiPane();

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
        <SettingsToggleCard
          label="Habit Tracking"
          value={preferences.enableHabits}
          onValueChange={(enableHabits) => updatePreferences({ enableHabits })}
        />

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
              <View style={{ gap: theme.gap }}>
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
  section: {
    gap: 10,
  },
});
