import { Href, Redirect, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
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
import { ModalLoadingScreen } from "@/components/ModalLoadingScreen";
import { ModalScreen } from "@/components/ModalScreen";
import { TextInput } from "@/components/TextInput";
import { WebModalHeader } from "@/components/WebModalHeader";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useHabits } from "@/hooks/useHabits";
import { useDismissModal } from "@/hooks/useDismissModal";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { showSaveError } from "@/utils/showSaveError";
import { useTheme } from "@/utils/theme";

/** Where this modal returns to when it can't just pop — one value, because a
 * stale link and a ✕ have to land in the same place. */
const HOME: Href = "/settings/habits";

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_EMOJI = "😄";
const MAX_STEPS = 999;

export default function HabitScreen() {
  // "/settings/habits/new" is the create route; any other id edits that habit.
  const { id } = useLocalSearchParams<{ id: string }>();
  const [, { getHabitById, isLoading }] = useHabits();

  // Decided by the route, not whether loaded — a cold cache would otherwise
  // treat an edit as a create and save a duplicate.
  const isEditing = id !== "new";
  const existing = getHabitById(isEditing ? id : null);

  // Still fetching: wait for the habit so the form initializes from its saved
  // values.
  if (isEditing && !existing && isLoading)
    return <ModalLoadingScreen fallback={HOME} />;

  // Loaded with no match (stale link / deleted habit): the id is invalid — bail
  // back to the list rather than spin forever.
  if (isEditing && !existing) return <Redirect href={HOME} />;

  // The `key` remounts the form if the resolved habit changes.
  return <HabitForm key={existing?.id ?? "new"} existing={existing} />;
}

function HabitForm({ existing }: { existing?: THabit }) {
  const theme = useTheme();

  const [, { createHabit, updateHabit }] = useHabits();
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

  const handleClose = useDismissModal(HOME);

  const handleSave = () => {
    if (hasSaved.current || !canSave) return;
    hasSaved.current = true;

    const callbacks = {
      onSuccess: handleClose,
      onError: () => {
        hasSaved.current = false;
        showSaveError("habit");
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
      // No "delete it instead" any more — there is nothing to point at (DEX-108).
      message: "Archiving hides the habit but keeps its history.",
      confirmLabel: "Archive",
      destructive: true,
    });
    if (!confirmed) return;
    updateHabit(
      { id: existing.id, isArchived: true },
      { onSuccess: handleClose, onError: () => showSaveError("habit") },
    );
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

  const inputBorder = theme.colors.border;

  return (
    <ModalScreen>
      <WebModalHeader
        isDisabled={!canSave}
        onClose={handleClose}
        onSave={handleSave}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          gap: theme.space.sm,
          padding: theme.space.md,
          // See `lists/[id].tsx`: the longhand reads clearer last.
          paddingBottom: theme.space.lg,
        }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.colors.background }}
      >
        <View style={[styles.titleRow, { gap: theme.space.sm }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Choose emoji"
            onPress={() => setPickerOpen(true)}
            style={[
              styles.emoji,
              {
                borderColor: inputBorder,
                borderRadius: theme.radii.md,
                // A tap target a step above a standard icon button — the emoji
                // is the screen's identity, not one of its controls.
                height: theme.controls.md + theme.space.sm,
                width: theme.controls.md + theme.space.sm,
              },
            ]}
          >
            <Text style={{ fontSize: theme.icons.md + theme.space.xs }}>
              {emoji}
            </Text>
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
          <View style={[styles.stepsControl, { gap: theme.space.sm }]}>
            <NativeTextInput
              accessibilityLabel="Times per day"
              value={steps}
              onChangeText={setSteps}
              keyboardType="number-pad"
              maxLength={3}
              style={[
                theme.fonts.control,
                styles.stepsInput,
                {
                  borderColor: inputBorder,
                  borderRadius: theme.radii.md,
                  color: theme.colors.text,
                  height: theme.controls.md,
                  paddingHorizontal: theme.space.sm,
                },
              ]}
            />
            <Text
              style={[theme.fonts.body, { color: theme.colors.textSecondary }]}
            >
              × daily
            </Text>
          </View>
        </FormRow>

        <FormRow label="Days">
          <WeekdayPicker
            valueSource="temporal"
            selected={daysActive}
            onToggle={toggleDay}
          />
        </FormRow>

        {/* Archive only, no delete (DEX-108) — a habit's history is the point
            of tracking it. `deleteHabit` still exists on the hook; nothing in the UI reaches it. */}
        {isEditing && (
          <View style={{ marginTop: theme.space.sm }}>
            <Button variant="dangerous" onPress={handleArchive}>
              Archive
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
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  emoji: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
  stepsControl: {
    alignItems: "center",
    flexDirection: "row",
  },
  stepsInput: {
    borderWidth: StyleSheet.hairlineWidth,
    // Wide enough for three digits plus the field's own padding.
    minWidth: 56,
    textAlign: "center",
  },
  titleInput: {
    flex: 1,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
  },
});
