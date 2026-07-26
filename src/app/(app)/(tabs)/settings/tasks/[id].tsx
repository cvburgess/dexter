import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
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
import { TTemplate, TTemplateSubtask } from "@/api/templates";
import { Button } from "@/components/Button";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { FormRow } from "@/components/FormRow";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PickerField } from "@/components/PickerField";
import { PriorityControl } from "@/components/PriorityControl";
import { SubtaskFields, withTitledRows } from "@/components/SubtaskFields";
import { TextInput } from "@/components/TextInput";
import { TimeField } from "@/components/TimeField";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { ModalScreen } from "@/components/ModalScreen";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useGoals } from "@/hooks/useGoals";
import { useLists } from "@/hooks/useLists";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { useTemplates } from "@/hooks/useTemplates";
import { DEFAULT_ALARM_TIME, isAlarmSupported } from "@/utils/alarms";
import {
  buildSchedule,
  parseSchedule,
  TRepeatFrequency,
} from "@/utils/repeatSchedule";
import { useTheme } from "@/utils/theme";

// The universal Picker's item values cannot be null, so "none" gets a sentinel
// that can never collide with a real id.
const NO_VALUE = "";

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

/**
 * "Never" is not a cadence, so it stays out of the shared `TRepeatFrequency`
 * union — it means "this row has no schedule at all", which is what makes it a
 * task template rather than a repeat task (DEX-65).
 */
type TEditorFrequency = TRepeatFrequency | "never";

const FREQUENCIES: { value: TEditorFrequency; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

// Max day-of-month per month (February = 29 to allow a leap-day yearly repeat).
// Used to clamp the yearly day picker so an impossible date like Feb 30 — which
// the schedule can never match — is unselectable.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const dayOptions = (maxDay: number) =>
  Array.from({ length: maxDay }, (_, i) => i + 1);

// RN's Alert is a no-op on web, so fall back to the browser's alert there.
const showSaveError = () => {
  const message = "We couldn't save your changes. Please try again.";

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
  const [alarmTime, setAlarmTime] = useState<string | null>(existing.alarmTime);
  const [subtasks, setSubtasks] = useState<TTemplateSubtask[]>(
    existing.subtasks,
  );
  // `parseSchedule` falls back to daily for a null schedule, so the template
  // case has to be read off the row itself rather than off the parse.
  const [frequency, setFrequency] = useState<TEditorFrequency>(
    existing.schedule === null ? "never" : parsed.frequency,
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

  // A template, not a repeat — drives every piece of copy on the screen so the
  // editor reads correctly the moment the frequency is switched, not only
  // after it is saved.
  const isTemplate = frequency === "never";

  const buildCurrentSchedule = (): string | null => {
    switch (frequency) {
      case "never":
        return null;
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
        alarmTime,
        schedule: buildCurrentSchedule(),
        // Drop any row left untitled — an empty row is an abandoned edit.
        subtasks: withTitledRows(subtasks),
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

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: isTemplate ? "Delete template?" : "Stop repeating?",
      message: isTemplate
        ? "This deletes the template. Tasks you already created from it are unaffected."
        : "This deletes the repeat schedule. The current task stays, but no new occurrences will be created.",
      confirmLabel: isTemplate ? "Delete Template" : "Stop Repeating",
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

  useModalHeaderActions({
    title: isTemplate ? "Template" : "Repeat Schedule",
    canSave,
    onClose: handleClose,
    onSave: handleSave,
  });

  return (
    <ModalScreen>
      <WebModalHeader
        isDisabled={!canSave}
        onClose={handleClose}
        onSave={handleSave}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        // Insets the content by the keyboard's height (iOS) so a subtask row it
        // covers stays reachable. Android resizes the window instead.
        automaticallyAdjustKeyboardInsets
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

        <FormRow label="Priority">
          <PriorityControl priority={priority} onChangePriority={setPriority} />
        </FormRow>

        <PickerField
          label="List"
          options={[
            { label: "None", value: NO_VALUE },
            ...lists.map((list) => ({
              label: `${list.emoji} ${list.title}`,
              value: list.id,
            })),
          ]}
          selectedValue={listId ?? NO_VALUE}
          onValueChange={(value) =>
            setListId(value === NO_VALUE ? null : value)
          }
        />

        <PickerField
          label="Goal"
          options={[
            { label: "None", value: NO_VALUE },
            ...goals.map((goal) => ({
              label: goal.emoji ? `${goal.emoji} ${goal.title}` : goal.title,
              value: goal.id,
            })),
          ]}
          selectedValue={goalId ?? NO_VALUE}
          onValueChange={(value) =>
            setGoalId(value === NO_VALUE ? null : value)
          }
        />

        {isAlarmSupported && (
          <FormRow label="Alarm">
            {alarmTime === null ? (
              <TouchableOpacity
                onPress={() => setAlarmTime(DEFAULT_ALARM_TIME)}
                accessibilityRole="button"
              >
                <Text
                  style={[styles.alarmAction, { color: theme.colors.primary }]}
                >
                  Add alarm
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.alarmControl, { gap: theme.gap }]}>
                <TimeField
                  accentColor={theme.colors.primary}
                  value={alarmTime}
                  onChange={setAlarmTime}
                />
                <TouchableOpacity
                  onPress={() => setAlarmTime(null)}
                  accessibilityRole="button"
                >
                  <Text
                    style={[styles.alarmAction, { color: theme.colors.error }]}
                  >
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </FormRow>
        )}

        <SubtaskFields
          value={subtasks}
          onChange={setSubtasks}
          makeRow={(id) => ({ id, title: "" })}
          testIDPrefix="template"
        />

        <PickerField
          label="Repeats"
          options={FREQUENCIES}
          selectedValue={frequency}
          onValueChange={setFrequency}
        />

        {frequency === "weekly" && (
          <FormRow label="On days">
            <WeekdayPicker
              valueSource="cron"
              selected={weekdays}
              onToggle={toggleWeekday}
            />
          </FormRow>
        )}

        {frequency === "yearly" && (
          <PickerField
            label="Month"
            options={MONTHS.map((label, index) => ({
              label,
              value: String(index + 1),
            }))}
            selectedValue={String(month)}
            onValueChange={(value) => {
              const nextMonth = Number(value);
              setMonth(nextMonth);
              // Clamp so switching to a shorter month can't leave an
              // impossible day selected (e.g. 31 → February).
              setDayOfMonth((day) =>
                Math.min(day, DAYS_IN_MONTH[nextMonth - 1]),
              );
            }}
          />
        )}

        {(frequency === "monthly" || frequency === "yearly") && (
          <PickerField
            label="Day of month"
            options={dayOptions(
              frequency === "yearly" ? DAYS_IN_MONTH[month - 1] : 31,
            ).map((day) => ({ label: String(day), value: String(day) }))}
            selectedValue={String(dayOfMonth)}
            onValueChange={(value) => setDayOfMonth(Number(value))}
          />
        )}

        <View style={styles.dangerZone}>
          <Button variant="dangerous" onPress={handleDelete}>
            {isTemplate ? "Delete Template" : "Stop Repeating"}
          </Button>
        </View>
      </ScrollView>

      <ConfirmationModal {...confirmationProps} />
    </ModalScreen>
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
  alarmControl: {
    alignItems: "center",
    flexDirection: "row",
  },
  alarmAction: {
    fontSize: 16,
    fontWeight: "600",
  },
});
