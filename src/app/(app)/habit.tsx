import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { TCreateHabit } from "@/api/habits";
import { Button } from "@/components/Button";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { CloseButton, DoneButton } from "@/components/ModalHeaderButtons";
import { TextInput } from "@/components/TextInput";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useHabits } from "@/hooks/useHabits";
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

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_EMOJI = "😄";
const MAX_STEPS = 999;

export default function HabitScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [, { createHabit, updateHabit, deleteHabit, getHabitById }] =
    useHabits();
  const { confirm, confirmationProps } = useConfirmation();

  const existing = getHabitById(id ?? null);
  const isEditing = !!existing;

  const [emoji, setEmoji] = useState(existing?.emoji ?? DEFAULT_EMOJI);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [steps, setSteps] = useState(String(existing?.steps ?? 1));
  const [daysActive, setDaysActive] = useState<number[]>(
    existing?.daysActive ?? ALL_DAYS,
  );
  const hasSaved = useRef(false);

  const parsedSteps = parseInt(steps, 10);
  const stepsValid =
    Number.isFinite(parsedSteps) && parsedSteps > 0 && parsedSteps <= MAX_STEPS;
  const canSave =
    title.trim().length > 0 && stepsValid && daysActive.length > 0;

  const handleClose = () => router.back();

  const handleSave = () => {
    if (hasSaved.current || !canSave) return;
    hasSaved.current = true;

    if (isEditing) {
      updateHabit({
        id: existing.id,
        emoji,
        title: title.trim(),
        steps: parsedSteps,
        daysActive,
      });
    } else {
      const habit: TCreateHabit = {
        emoji,
        title: title.trim(),
        steps: parsedSteps,
        daysActive,
      };
      createHabit(habit);
    }
    router.back();
  };

  const handleArchive = async () => {
    if (!existing) return;
    const confirmed = await confirm({
      title: `Archive ${existing.title}?`,
      message:
        "Archiving hides the habit but keeps its history. To erase all history, delete it instead.",
      confirmLabel: "Archive",
      destructive: true,
    });
    if (!confirmed) return;
    updateHabit({ id: existing.id, isArchived: true });
    router.back();
  };

  const handleDelete = async () => {
    if (!existing) return;
    const confirmed = await confirm({
      title: `Delete ${existing.title}?`,
      message: "This permanently deletes the habit and all of its history.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    deleteHabit(existing.id);
    router.back();
  };

  const toggleDay = (day: number) =>
    setDaysActive((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );

  // No dependency array: the handlers close over the latest form state, so the
  // header must be re-wired on every render (mirrors new-task.tsx).
  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Edit Habit" : "New Habit",
      headerLeft: () => <CloseButton onPress={handleClose} />,
      headerRight: () => (
        <DoneButton disabled={!canSave} onPress={handleSave} />
      ),
      unstable_headerLeftItems: () => [
        {
          type: "button",
          label: "Cancel",
          icon: { type: "sfSymbol", name: "xmark" },
          tintColor: theme.colors.text,
          onPress: handleClose,
        },
      ],
      unstable_headerRightItems: () => [
        {
          type: "button",
          label: "Save",
          icon: { type: "sfSymbol", name: "checkmark" },
          variant: "done",
          tintColor: theme.colors.primary,
          disabled: !canSave,
          onPress: handleSave,
        },
      ],
    });
  });

  const inputBorder = withOpacity(theme.colors.text, 0.1);

  return (
    <>
      <WebModalHeader
        isDisabled={!canSave}
        onClose={handleClose}
        onSave={handleSave}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.container,
          { gap: theme.gap, padding: theme.spacing },
        ]}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.colors.background }}
      >
        <View style={styles.titleRow}>
          <NativeTextInput
            accessibilityLabel="Habit emoji"
            value={emoji}
            onChangeText={setEmoji}
            maxLength={2}
            style={[
              styles.emoji,
              { borderColor: inputBorder, color: theme.colors.text },
            ]}
          />
          <TextInput
            accessibilityLabel="Habit title"
            autoFocus={!isEditing}
            placeholder="What habit do you want to build?"
            returnKeyType="done"
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={handleSave}
          />
        </View>

        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Times per day
          </Text>
          <View style={styles.stepsControl}>
            <NativeTextInput
              accessibilityLabel="Times per day"
              value={steps}
              onChangeText={setSteps}
              keyboardType="number-pad"
              maxLength={3}
              style={[
                styles.stepsInput,
                { borderColor: inputBorder, color: theme.colors.text },
              ]}
            />
            <Text
              style={[
                styles.labelDetail,
                { color: theme.colors.textSecondary },
              ]}
            >
              × daily
            </Text>
          </View>
        </View>

        <View style={styles.daysSection}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Active days
          </Text>
          <View style={styles.days}>
            {DAYS.map((day, index) => {
              const selected = daysActive.includes(day.value);
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
        </View>

        {isEditing && (
          <View style={styles.dangerZone}>
            <Button variant="dangerous" onPress={handleArchive}>
              Archive
            </Button>
            <Button variant="dangerous" onPress={handleDelete}>
              Delete
            </Button>
          </View>
        )}
      </ScrollView>

      <ConfirmationModal {...confirmationProps} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  dangerZone: {
    gap: 12,
    marginTop: 12,
  },
  day: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  days: {
    flexDirection: "row",
    gap: 8,
  },
  daysSection: {
    gap: 10,
  },
  emoji: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 22,
    height: 50,
    textAlign: "center",
    width: 50,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  labelDetail: {
    fontSize: 14,
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 40,
  },
  stepsControl: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  stepsInput: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    height: 40,
    minWidth: 56,
    paddingHorizontal: 8,
    textAlign: "center",
  },
  titleInput: {
    flex: 1,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
});
