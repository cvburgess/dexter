import { Host, Picker } from "@expo/ui";
import {
  Redirect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { useLayoutEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ETaskPriority } from "@/api/tasks";
import { TTemplate } from "@/api/templates";
import { Button } from "@/components/Button";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { LoadingScreen } from "@/components/LoadingScreen";
import { CloseButton, DoneButton } from "@/components/ModalHeaderButtons";
import { PriorityControl } from "@/components/PriorityControl";
import { TextInput } from "@/components/TextInput";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useGoals } from "@/hooks/useGoals";
import { useLists } from "@/hooks/useLists";
import { useTemplates } from "@/hooks/useTemplates";
import {
  buildSchedule,
  parseSchedule,
  TRepeatFrequency,
} from "@/utils/repeatSchedule";
import { useTheme, withOpacity } from "@/utils/theme";

// The universal Picker's item values cannot be null, so "none" gets a sentinel
// that can never collide with a real id.
const NO_VALUE = "";

// Cron day-of-week (0 = Sunday), ordered Monday-first to match the habit editor.
const WEEKDAYS = [
  { cron: 1, label: "M" },
  { cron: 2, label: "T" },
  { cron: 3, label: "W" },
  { cron: 4, label: "T" },
  { cron: 5, label: "F" },
  { cron: 6, label: "S" },
  { cron: 0, label: "S" },
] as const;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const FREQUENCIES: { value: TRepeatFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const daysInLongestMonth = Array.from({ length: 31 }, (_, i) => i + 1);

// RN's Alert is a no-op on web, so fall back to the browser's alert there.
const showSaveError = () => {
  const message = "We couldn't save the repeat schedule. Please try again.";

  if (Platform.OS === "web") {
    window.alert(message);
  } else {
    Alert.alert("Something went wrong", message);
  }
};

export default function RepeatScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [, { getTemplateById, isLoading }] = useTemplates();
  const existing = getTemplateById(id);

  if (!existing) {
    // Still fetching: wait for the template so the form initializes from its
    // saved values. Once loaded with no match (stale link / deleted template),
    // the id is invalid — bail back to the list rather than spin forever.
    return isLoading ? <LoadingScreen /> : <Redirect href="/settings/tasks" />;
  }

  // The `key` remounts the form if the resolved template changes.
  return <RepeatScheduleForm key={existing.id} existing={existing} />;
}

function RepeatScheduleForm({ existing }: { existing: TTemplate }) {
  const theme = useTheme();
  const navigation = useNavigation();
  const router = useRouter();

  const [lists] = useLists();
  const [goals] = useGoals();
  const [, { updateTemplate, deleteTemplate }] = useTemplates();
  const { confirm, confirmationProps } = useConfirmation();

  const parsed = parseSchedule(existing.schedule);

  const [title, setTitle] = useState(existing.title);
  const [priority, setPriority] = useState<ETaskPriority>(existing.priority);
  const [listId, setListId] = useState<string | null>(existing.listId);
  const [goalId, setGoalId] = useState<string | null>(existing.goalId);
  const [frequency, setFrequency] = useState<TRepeatFrequency>(
    parsed.frequency,
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    parsed.frequency === "weekly" ? parsed.weekdays : [1],
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    parsed.frequency === "monthly" || parsed.frequency === "yearly"
      ? parsed.dayOfMonth
      : 1,
  );
  const [month, setMonth] = useState(
    parsed.frequency === "yearly" ? parsed.month : 1,
  );
  const hasSaved = useRef(false);

  const canSave =
    title.trim().length > 0 && (frequency !== "weekly" || weekdays.length > 0);

  const buildCurrentSchedule = (): string => {
    switch (frequency) {
      case "daily":
        return buildSchedule({ frequency: "daily" });
      case "weekly":
        return buildSchedule({ frequency: "weekly", weekdays });
      case "monthly":
        return buildSchedule({ frequency: "monthly", dayOfMonth });
      case "yearly":
        return buildSchedule({ frequency: "yearly", month, dayOfMonth });
    }
  };

  const handleClose = () => router.back();

  const handleSave = () => {
    if (hasSaved.current || !canSave) return;
    hasSaved.current = true;

    updateTemplate(
      {
        id: existing.id,
        title: title.trim(),
        priority,
        listId,
        goalId,
        schedule: buildCurrentSchedule(),
      },
      {
        onSuccess: () => router.back(),
        onError: () => {
          hasSaved.current = false;
          showSaveError();
        },
      },
    );
  };

  const handleStopRepeating = async () => {
    const confirmed = await confirm({
      title: "Stop repeating?",
      message:
        "This deletes the repeat schedule. The current task stays, but no new occurrences will be created.",
      confirmLabel: "Stop Repeating",
      destructive: true,
    });
    if (!confirmed) return;
    deleteTemplate(existing.id, {
      onSuccess: () => router.back(),
      onError: showSaveError,
    });
  };

  const toggleWeekday = (day: number) =>
    setWeekdays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );

  // No dependency array: the handlers close over the latest form state, so the
  // header must be re-wired on every render (mirrors habits/[id].tsx).
  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Repeat Schedule",
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
        <TextInput
          accessibilityLabel="Task title"
          placeholder="What needs to be done?"
          returnKeyType="done"
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={handleSave}
        />

        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Priority
          </Text>
          <PriorityControl priority={priority} onChangePriority={setPriority} />
        </View>

        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: theme.colors.text }]}>List</Text>
          <Host matchContents>
            <Picker
              appearance="menu"
              selectedValue={listId ?? NO_VALUE}
              onValueChange={(value) =>
                setListId(value === NO_VALUE ? null : String(value))
              }
            >
              <Picker.Item label="None" value={NO_VALUE} />
              {lists.map((list) => (
                <Picker.Item
                  key={list.id}
                  label={`${list.emoji} ${list.title}`}
                  value={list.id}
                />
              ))}
            </Picker>
          </Host>
        </View>

        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Goal</Text>
          <Host matchContents>
            <Picker
              appearance="menu"
              selectedValue={goalId ?? NO_VALUE}
              onValueChange={(value) =>
                setGoalId(value === NO_VALUE ? null : String(value))
              }
            >
              <Picker.Item label="None" value={NO_VALUE} />
              {goals.map((goal) => (
                <Picker.Item
                  key={goal.id}
                  label={
                    goal.emoji ? `${goal.emoji} ${goal.title}` : goal.title
                  }
                  value={goal.id}
                />
              ))}
            </Picker>
          </Host>
        </View>

        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Repeats
          </Text>
          <Host matchContents>
            <Picker
              appearance="menu"
              selectedValue={frequency}
              onValueChange={(value) => setFrequency(value)}
            >
              {FREQUENCIES.map((option) => (
                <Picker.Item
                  key={option.value}
                  label={option.label}
                  value={option.value}
                />
              ))}
            </Picker>
          </Host>
        </View>

        {frequency === "weekly" && (
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              On days
            </Text>
            <View style={styles.days}>
              {WEEKDAYS.map((day, index) => {
                const selected = weekdays.includes(day.cron);
                return (
                  <TouchableOpacity
                    key={index}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Weekday ${day.cron}`}
                    onPress={() => toggleWeekday(day.cron)}
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
        )}

        {frequency === "yearly" && (
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Month
            </Text>
            <Host matchContents>
              <Picker
                appearance="menu"
                selectedValue={String(month)}
                onValueChange={(value) => setMonth(Number(value))}
              >
                {MONTHS.map((label, index) => (
                  <Picker.Item
                    key={label}
                    label={label}
                    value={String(index + 1)}
                  />
                ))}
              </Picker>
            </Host>
          </View>
        )}

        {(frequency === "monthly" || frequency === "yearly") && (
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Day of month
            </Text>
            <Host matchContents>
              <Picker
                appearance="menu"
                selectedValue={String(dayOfMonth)}
                onValueChange={(value) => setDayOfMonth(Number(value))}
              >
                {daysInLongestMonth.map((day) => (
                  <Picker.Item
                    key={day}
                    label={String(day)}
                    value={String(day)}
                  />
                ))}
              </Picker>
            </Host>
          </View>
        )}

        <View style={styles.dangerZone}>
          <Button variant="dangerous" onPress={handleStopRepeating}>
            Stop Repeating
          </Button>
        </View>
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
    gap: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 40,
  },
});
