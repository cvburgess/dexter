import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { TCreateHabit, THabit } from "@/api/habits";
import { Button } from "@/components/Button";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { EmojiPicker } from "@/components/EmojiPicker";
import { FormRow } from "@/components/FormRow";
import { LoadingScreen } from "@/components/LoadingScreen";
import { TextInput } from "@/components/TextInput";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useHabits } from "@/hooks/useHabits";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { useTheme, withOpacity } from "@/utils/theme";

// Temporal's `dayOfWeek`: Monday = 1 … Sunday = 7.
const DAYS = [
  { value: 1, label: "M", accessibilityLabel: "Day 1" },
  { value: 2, label: "T", accessibilityLabel: "Day 2" },
  { value: 3, label: "W", accessibilityLabel: "Day 3" },
  { value: 4, label: "T", accessibilityLabel: "Day 4" },
  { value: 5, label: "F", accessibilityLabel: "Day 5" },
  { value: 6, label: "S", accessibilityLabel: "Day 6" },
  { value: 7, label: "S", accessibilityLabel: "Day 7" },
] as const;

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_EMOJI = "😄";
const MAX_STEPS = 999;

// RN's Alert is a no-op on web, so fall back to the browser's alert there.
const showSaveError = () => {
  const message = "We couldn't save your habit. Please try again.";

  if (Platform.OS === "web") {
    window.alert(message);
  } else {
    Alert.alert("Something went wrong", message);
  }
};

export default function HabitScreen() {
  // "/settings/habits/new" is the create route; any other id edits that habit.
  const { id } = useLocalSearchParams<{ id: string }>();
  const [, { getHabitById, isLoading }] = useHabits();

  // Editing is decided by the route, not by whether the habit has loaded yet —
  // otherwise a cold cache (deep link / web reload) would treat an edit as a
  // create and save a duplicate.
  const isEditing = id !== "new";
  const existing = getHabitById(isEditing ? id : null);

  if (isEditing && !existing) {
    // Still fetching: wait for the habit so the form initializes from its saved
    // values. Once loaded with no match (stale link / deleted habit), the id is
    // invalid — bail back to the list rather than spin forever.
    return isLoading ? <LoadingScreen /> : <Redirect href="/settings/habits" />;
  }

  // The `key` remounts the form if the resolved habit changes.
  return <HabitForm key={existing?.id ?? "new"} existing={existing} />;
}

function HabitForm({ existing }: { existing?: THabit }) {
  const theme = useTheme();
  const router = useRouter();

  const [, { createHabit, updateHabit, deleteHabit }] = useHabits();
  const { confirm, confirmationProps } = useConfirmation();

  const isEditing = !!existing;

  const [emoji, setEmoji] = useState(existing?.emoji ?? DEFAULT_EMOJI);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [steps, setSteps] = useState(String(existing?.steps ?? 1));
  const [daysActive, setDaysActive] = useState<number[]>(
    existing?.daysActive ?? ALL_DAYS,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
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

    const callbacks = {
      onSuccess: () => router.back(),
      onError: () => {
        hasSaved.current = false;
        showSaveError();
      },
    };

    if (isEditing && existing) {
      updateHabit(
        {
          id: existing.id,
          emoji,
          title: title.trim(),
          steps: parsedSteps,
          daysActive,
        },
        callbacks,
      );
    } else {
      const habit: TCreateHabit = {
        emoji,
        title: title.trim(),
        steps: parsedSteps,
        daysActive,
      };
      createHabit(habit, callbacks);
    }
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
    updateHabit(
      { id: existing.id, isArchived: true },
      { onSuccess: () => router.back(), onError: showSaveError },
    );
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
    deleteHabit(existing.id, {
      onSuccess: () => router.back(),
      onError: showSaveError,
    });
  };

  const toggleDay = (day: number) =>
    setDaysActive((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );

  useModalHeaderActions({
    title: isEditing ? "Edit Habit" : "New Habit",
    canSave,
    onClose: handleClose,
    onSave: handleSave,
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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Choose emoji"
            onPress={() => setPickerOpen(true)}
            style={[
              styles.emoji,
              { borderColor: inputBorder, borderRadius: theme.borderRadius },
            ]}
          >
            <Text style={styles.emojiGlyph}>{emoji}</Text>
          </TouchableOpacity>
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

        <FormRow label="Times per day">
          <View style={styles.stepsControl}>
            <NativeTextInput
              accessibilityLabel="Times per day"
              value={steps}
              onChangeText={setSteps}
              keyboardType="number-pad"
              maxLength={3}
              style={[
                styles.stepsInput,
                {
                  borderColor: inputBorder,
                  borderRadius: theme.borderRadius,
                  color: theme.colors.text,
                },
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
        </FormRow>

        <FormRow label="Days">
          <WeekdayPicker
            days={DAYS}
            selected={daysActive}
            onToggle={toggleDay}
          />
        </FormRow>

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

      <EmojiPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(next) => {
          setEmoji(next);
          setPickerOpen(false);
        }}
      />

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
  emoji: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  emojiGlyph: {
    fontSize: 24,
  },
  labelDetail: {
    fontSize: 14,
  },
  stepsControl: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  stepsInput: {
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
