import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { THabit, TUpdateHabit } from "@/api/habits";
import { IconMenu } from "@/components/IconMenu";
import type { ConfirmOptions } from "@/hooks/useConfirmation";
import { useTheme, withOpacity } from "@/utils/theme";

// Temporal's `dayOfWeek`: Monday = 1 … Sunday = 7.
const DAYS = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 7, label: "S" },
] as const;

const MAX_STEPS = 999;

type THabitRowProps = {
  habit: THabit;
  updateHabit: (habit: TUpdateHabit) => void;
  deleteHabit: (id: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

/**
 * Inline editor for a single habit — emoji, title, per-day schedule, steps,
 * pause, and archive/delete. Ported from dexter-app's `Settings/Habits`; text
 * fields save on blur (rather than the web app's debounce) to avoid a new dep.
 */
export function HabitRow({
  habit,
  updateHabit,
  deleteHabit,
  confirm,
}: THabitRowProps) {
  const theme = useTheme();

  const [emoji, setEmoji] = useState(habit.emoji);
  const [title, setTitle] = useState(habit.title);
  const [steps, setSteps] = useState(String(habit.steps));

  const inputBorder = withOpacity(theme.colors.text, 0.1);

  const commitEmoji = () => {
    const next = emoji.trim();
    if (!next) {
      setEmoji(habit.emoji);
      return;
    }
    if (next !== habit.emoji) updateHabit({ id: habit.id, emoji: next });
  };

  const commitTitle = () => {
    const next = title.trim();
    if (!next) {
      setTitle(habit.title);
      return;
    }
    if (next !== habit.title) updateHabit({ id: habit.id, title: next });
  };

  const commitSteps = () => {
    const parsed = parseInt(steps, 10);
    const isValid =
      Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_STEPS;
    if (!isValid) {
      setSteps(String(habit.steps));
      return;
    }
    if (parsed !== habit.steps) updateHabit({ id: habit.id, steps: parsed });
    setSteps(String(parsed));
  };

  const toggleDay = (day: number) => {
    const active = habit.daysActive.includes(day);
    const daysActive = active
      ? habit.daysActive.filter((d) => d !== day)
      : [...habit.daysActive, day].sort((a, b) => a - b);
    // Keep at least one active day so the habit still surfaces somewhere.
    if (daysActive.length === 0) return;
    updateHabit({ id: habit.id, daysActive });
  };

  const handleArchive = async () => {
    const confirmed = await confirm({
      title: `Archive ${habit.title}?`,
      message:
        "Archiving hides the habit but keeps its history. To erase all history, delete it instead.",
      confirmLabel: "Archive",
      destructive: true,
    });
    if (confirmed) updateHabit({ id: habit.id, isArchived: true });
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: `Delete ${habit.title}?`,
      message: "This permanently deletes the habit and all of its history.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) deleteHabit(habit.id);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius,
          gap: theme.gap,
        },
      ]}
    >
      <View style={styles.topRow}>
        <TextInput
          accessibilityLabel="Habit emoji"
          value={emoji}
          onChangeText={setEmoji}
          onBlur={commitEmoji}
          onEndEditing={commitEmoji}
          maxLength={2}
          style={[styles.emoji, { borderColor: inputBorder }]}
        />
        <TextInput
          accessibilityLabel="Habit title"
          value={title}
          onChangeText={setTitle}
          onBlur={commitTitle}
          onSubmitEditing={commitTitle}
          placeholder="Habit name"
          placeholderTextColor={theme.colors.textSecondary}
          returnKeyType="done"
          style={[
            styles.title,
            { borderColor: inputBorder, color: theme.colors.text },
          ]}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={habit.isPaused ? "Resume habit" : "Pause habit"}
          onPress={() =>
            updateHabit({ id: habit.id, isPaused: !habit.isPaused })
          }
          style={styles.iconButton}
        >
          <SymbolView
            name={habit.isPaused ? "play" : "pause"}
            size={20}
            tintColor={theme.colors.textSecondary}
          />
        </TouchableOpacity>
        <IconMenu
          accessibilityLabel="Remove habit"
          menuTitle={habit.title}
          sections={[
            {
              options: [
                {
                  id: "archive",
                  title: "Archive",
                  icon: {
                    ios: "archivebox",
                    android: "archive",
                    web: "archive",
                  },
                  isDestructive: true,
                  onSelect: () => void handleArchive(),
                },
                {
                  id: "delete",
                  title: "Delete",
                  icon: { ios: "trash", android: "delete", web: "delete" },
                  isDestructive: true,
                  onSelect: () => void handleDelete(),
                },
              ],
            },
          ]}
          style={styles.iconButton}
        >
          <SymbolView
            name="ellipsis"
            size={20}
            tintColor={theme.colors.textSecondary}
          />
        </IconMenu>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.days}>
          {DAYS.map((day, index) => {
            const selected = habit.daysActive.includes(day.value);
            return (
              <TouchableOpacity
                key={index}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Day ${day.value}`}
                onPress={() => toggleDay(day.value)}
                style={[
                  styles.day,
                  {
                    backgroundColor: selected
                      ? theme.colors.primary
                      : "transparent",
                    borderColor: inputBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    {
                      color: selected
                        ? theme.colors.primaryContent
                        : theme.colors.textSecondary,
                    },
                  ]}
                >
                  {day.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.steps}>
          <TextInput
            accessibilityLabel="Times per day"
            value={steps}
            onChangeText={setSteps}
            onBlur={commitSteps}
            onEndEditing={commitSteps}
            keyboardType="number-pad"
            maxLength={3}
            style={[
              styles.stepsInput,
              { borderColor: inputBorder, color: theme.colors.text },
            ]}
          />
          <Text
            style={[styles.stepsLabel, { color: theme.colors.textSecondary }]}
          >
            × daily
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  card: {
    padding: 12,
  },
  day: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  days: {
    flexDirection: "row",
    gap: 6,
  },
  emoji: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 20,
    height: 44,
    textAlign: "center",
    width: 44,
  },
  iconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 32,
  },
  steps: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  stepsInput: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    height: 44,
    minWidth: 48,
    paddingHorizontal: 8,
    textAlign: "center",
  },
  stepsLabel: {
    fontSize: 14,
  },
  title: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    fontSize: 16,
    height: 44,
    paddingHorizontal: 12,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
});
