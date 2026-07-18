import { Temporal } from "@js-temporal/polyfill";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { DateField } from "@/components/DateField";
import { FormRow } from "@/components/FormRow";
import { PickerField } from "@/components/PickerField";
import { PriorityControl } from "@/components/PriorityControl";
import { TextInput } from "@/components/TextInput";
import { TimeField } from "@/components/TimeField";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useLists } from "@/hooks/useLists";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { useNewTaskForm } from "@/hooks/useNewTaskForm";
import { useTasks } from "@/hooks/useTasks";
import {
  DEFAULT_ALARM_TIME,
  isAlarmSupported,
  requestAlarmAuthorization,
} from "@/utils/alarms";
import { useTheme } from "@/utils/theme";

// The universal Picker's item values cannot be null, so "no list" gets a
// sentinel that can never collide with a list id.
const NO_LIST = "";

const plainDateToDate = (iso: string): Date => {
  const date = Temporal.PlainDate.from(iso);
  return new Date(date.year, date.month - 1, date.day);
};

const dateToPlainDateISO = (date: Date): string =>
  Temporal.PlainDate.from({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }).toString();

// RN's Alert is a no-op on web, so fall back to the browser's alert there.
const showSaveError = () => {
  const message = "We couldn't save your task. Please try again.";

  if (Platform.OS === "web") {
    window.alert(message);
  } else {
    Alert.alert("Something went wrong", message);
  }
};

export default function NewTaskScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [lists, { isLoading: isLoadingLists }] = useLists();
  const [, { createTask }] = useTasks({ skipQuery: true });
  // Set by NewTaskButton to the day the user was viewing; absent → today.
  const { scheduledFor } = useLocalSearchParams<{ scheduledFor?: string }>();
  const form = useNewTaskForm(lists, scheduledFor);
  const hasSaved = useRef(false);

  // Saving waits for lists so `#list` tokens in the title can resolve, and
  // is one-shot so a double tap can't create duplicate tasks.
  const canSave = form.canSave && !isLoadingLists;

  const handleClose = () => router.back();

  // Enabling an alarm needs AlarmKit permission before it can ring, so a denied
  // request is surfaced rather than silently seeding an alarm that won't fire
  // (mirrors TaskCard.handleConfirmAlarm — DEX-48).
  const handleAddAlarm = async () => {
    const authorized = await requestAlarmAuthorization();
    if (!authorized) {
      Alert.alert(
        "Alarms are turned off",
        "Enable alarms for Dexter in Settings to be reminded at a set time.",
      );
      return;
    }
    form.setAlarmTime(DEFAULT_ALARM_TIME);
  };

  const handleSave = () => {
    if (hasSaved.current || !canSave) return;
    hasSaved.current = true;
    createTask(form.task, {
      onSuccess: () => router.back(),
      onError: () => {
        hasSaved.current = false;
        showSaveError();
      },
    });
  };

  useModalHeaderActions({ canSave, onClose: handleClose, onSave: handleSave });

  return (
    <>
      <WebModalHeader
        isDisabled={!canSave}
        onClose={handleClose}
        onSave={handleSave}
      />
      <ScrollView
        // Keeps the content below the native header, which floats over the
        // form sheet on iOS.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.container,
          { gap: theme.gap, padding: theme.spacing },
        ]}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.colors.background }}
      >
        <TextInput
          autoFocus
          placeholder="What needs to be done?"
          returnKeyType="done"
          testID="new-task-title"
          value={form.title}
          onChangeText={form.setTitle}
          onSubmitEditing={handleSave}
        />

        <FormRow label="Priority" minHeight={32}>
          <PriorityControl
            priority={form.priority}
            onChangePriority={form.setPriority}
          />
        </FormRow>

        <PickerField
          label="List"
          minHeight={32}
          testID="new-task-list"
          options={[
            { label: "None", value: NO_LIST },
            ...lists.map((list) => ({
              label: `${list.emoji} ${list.title}`,
              value: list.id,
            })),
          ]}
          selectedValue={form.listId ?? NO_LIST}
          onValueChange={(listId) =>
            form.setListId(listId === NO_LIST ? null : listId)
          }
        />

        <FormRow label="Schedule" minHeight={32}>
          <DateField
            accentColor={theme.colors.primary}
            testID="new-task-schedule"
            value={plainDateToDate(form.scheduledFor)}
            onChange={(date) => form.setScheduledFor(dateToPlainDateISO(date))}
          />
        </FormRow>

        <FormRow label="Deadline" minHeight={32}>
          <DeadlineField dueOn={form.dueOn} onChange={form.setDueOn} />
        </FormRow>

        {isAlarmSupported && (
          <FormRow label="Alarm" minHeight={32}>
            {form.alarmTime === null ? (
              <TouchableOpacity
                accessibilityRole="button"
                testID="new-task-add-alarm"
                onPress={handleAddAlarm}
              >
                <Text
                  style={[styles.labelDetail, { color: theme.colors.primary }]}
                >
                  Add alarm
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.alarmControls, { gap: theme.gap }]}>
                <TimeField
                  accentColor={theme.colors.primary}
                  testID="new-task-alarm"
                  value={form.alarmTime}
                  onChange={form.setAlarmTime}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  testID="new-task-clear-alarm"
                  onPress={() => form.setAlarmTime(null)}
                >
                  <Text
                    style={[
                      styles.labelDetail,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </FormRow>
        )}
      </ScrollView>
    </>
  );
}

type TDeadlineFieldProps = {
  dueOn: string | null;
  onChange: (dueOn: string | null) => void;
};

function DeadlineField({ dueOn, onChange }: TDeadlineFieldProps) {
  const theme = useTheme();

  if (dueOn === null) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        testID="new-task-add-deadline"
        onPress={() => onChange(Temporal.Now.plainDateISO().toString())}
      >
        <Text style={[styles.labelDetail, { color: theme.colors.primary }]}>
          Add deadline
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.deadlineControls, { gap: theme.gap }]}>
      <DateField
        accentColor={theme.colors.primary}
        testID="new-task-deadline"
        value={plainDateToDate(dueOn)}
        onChange={(date) => onChange(dateToPlainDateISO(date))}
      />
      <TouchableOpacity
        accessibilityRole="button"
        testID="new-task-clear-deadline"
        onPress={() => onChange(null)}
      >
        <Text
          style={[styles.labelDetail, { color: theme.colors.textSecondary }]}
        >
          Clear
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  deadlineControls: {
    alignItems: "center",
    flexDirection: "row",
  },
  alarmControls: {
    alignItems: "center",
    flexDirection: "row",
  },
  labelDetail: {
    fontSize: 14,
  },
});
