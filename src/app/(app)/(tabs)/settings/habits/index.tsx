import { useNavigation, useRouter } from "expo-router";
import { useLayoutEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { HabitRow } from "@/components/HabitRow";
import { HeaderAddButton } from "@/components/HeaderAddButton";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { SettingsToggleCard } from "@/components/SettingsToggleCard";
import { useHabits } from "@/hooks/useHabits";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import {
  EDGES_SINGLE_PANE,
  EDGES_TWO_PANE,
} from "@/utils/settingsSafeAreaEdges";
import { useTheme } from "@/utils/theme";

export default function HabitsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const [habits, { updateHabit }] = useHabits();
  const [preferences, { updatePreferences }] = usePreferences();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = useIsLargeDevice();
  const insets = useSafeAreaInsets();

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
            padding: theme.space.md,
            paddingBottom: theme.space.md + insets.bottom,
            // `lg` between sections, `xs` within one (`styles.section`): the
            // groups had been separated by the same step that separated a
            // title from its own content, so nothing read as grouped (DEX-61).
            gap: theme.space.lg,
          },
        ]}
      >
        <SettingsToggleCard
          label="Habit Tracking"
          value={preferences.enableHabits}
          onValueChange={(enableHabits) => updatePreferences({ enableHabits })}
        />

        {preferences.enableHabits && (
          <View style={{ gap: theme.space.xs }}>
            <SettingsSectionTitle>Habits</SettingsSectionTitle>
            {habits.length === 0 ? (
              <Text
                style={[
                  theme.fonts.body,
                  { paddingVertical: theme.space.sm },
                  { color: theme.colors.textSecondary },
                ]}
              >
                Tap ＋ to create your first habit.
              </Text>
            ) : (
              <View style={{ gap: theme.space.sm }}>
                {habits.map((habit) => (
                  <View
                    key={habit.id}
                    style={[
                      styles.card,
                      { paddingHorizontal: theme.space.md },
                      {
                        backgroundColor: theme.colors.card,
                        borderRadius: theme.radii.md,
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
  },
});
