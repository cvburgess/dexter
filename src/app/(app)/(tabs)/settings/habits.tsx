import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TCreateHabit } from "@/api/habits";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { HabitRow } from "@/components/HabitRow";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useHabits } from "@/hooks/useHabits";
import { usePreferences } from "@/hooks/usePreferences";
import { SETTINGS_TWO_PANE_MIN_WIDTH } from "@/utils/settingsItems";
import { useTheme, withOpacity } from "@/utils/theme";

const DEFAULT_HABIT: Omit<TCreateHabit, "title"> = {
  emoji: "😄",
  daysActive: [1, 2, 3, 4, 5, 6, 7],
  steps: 1,
};

export default function HabitsScreen() {
  const theme = useTheme();
  const [habits, { createHabit, updateHabit, deleteHabit }] = useHabits();
  const [preferences, { updatePreferences }] = usePreferences();
  const { confirm, confirmationProps } = useConfirmation();
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
        keyboardShouldPersistTaps="handled"
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
            {habits.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                updateHabit={updateHabit}
                deleteHabit={deleteHabit}
                confirm={confirm}
              />
            ))}
            <NewHabitInput onCreate={createHabit} />
          </View>
        )}
      </ScrollView>

      <ConfirmationModal {...confirmationProps} />
    </SafeAreaView>
  );
}

function NewHabitInput({
  onCreate,
}: {
  onCreate: (habit: TCreateHabit) => void;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState("");

  const submit = () => {
    const next = title.trim();
    if (!next) return;
    onCreate({ ...DEFAULT_HABIT, title: next });
    setTitle("");
  };

  return (
    <TextInput
      accessibilityLabel="New habit"
      value={title}
      onChangeText={setTitle}
      onSubmitEditing={submit}
      placeholder="+ New habit"
      placeholderTextColor={theme.colors.textSecondary}
      returnKeyType="done"
      style={[
        styles.newHabit,
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius,
          color: theme.colors.text,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  newHabit: {
    fontSize: 16,
    padding: 16,
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
