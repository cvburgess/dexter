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

import { ETaskStatus } from "@/api/tasks";
import { DateField } from "@/components/DateField";
import { FormRow } from "@/components/FormRow";
import { PickerField } from "@/components/PickerField";
import { PriorityControl } from "@/components/PriorityControl";
import { SubtaskFields } from "@/components/SubtaskFields";
import { TextInput } from "@/components/TextInput";
import { TimeField } from "@/components/TimeField";
import { ModalScreen } from "@/components/ModalScreen";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useLists } from "@/hooks/useLists";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { useNewTaskForm } from "@/hooks/useNewTaskForm";
import { useTasks } from "@/hooks/useTasks";
import {
  currentAlarmTime,
  defaultAlarmTime,
  isAlarmSupported,
  requestAlarmAuthorization,
} from "@/utils/alarms";
import { dateToPlainDateISO, plainDateISOToDate } from "@/utils/plainDate";
import { useTheme } from "@/utils/theme";

// The universal Picker's item values cannot be null, so "no list" gets a
// sentinel that can never collide with a list id.
const NO_LIST = "";

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
  const scrollRef = useRef<ScrollView>(null);
  // Set when a subtask row is added, consumed by the next content size change.
  const pendingScroll = useRef(false);

  // Saving waits for lists so `#list` tokens in the title can resolve, and
  // is one-shot so a double tap can't create duplicate tasks.
  const canSave = form.canSave && !isLoadingLists;

  const handleClose = () => router.back();

  // An alarm fires on the task's scheduled day, so the two move together (the
  // rule TaskCard already applies to saved tasks): unscheduling drops the
  // alarm, and setting one on an unscheduled task pulls it onto today. No
  // confirmation here — nothing is saved yet, and the Alarm row visibly
  // reverting to "Add alarm" is the feedback.
  const handleChangeSchedule = (scheduledFor: string | null) => {
    form.setScheduledFor(scheduledFor);
    if (scheduledFor === null) form.setAlarmTime(null);
  };

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
    if (form.scheduledFor === null) {
      form.setScheduledFor(Temporal.Now.plainDateISO().toString());
    }
    form.setAlarmTime(defaultAlarmTime());
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
    <ModalScreen>
      <WebModalHeader
        isDisabled={!canSave}
        onClose={handleClose}
        onSave={handleSave}
      />
      <ScrollView
        ref={scrollRef}
        // Keeps the content below the native header, which floats over the
        // form sheet on iOS.
        contentInsetAdjustmentBehavior="automatic"
        // Insets the content by the keyboard's height (iOS) so the fields it
        // covers stay reachable. Android resizes the window instead (Expo's
        // default softwareKeyboardLayoutMode), and web has no overlay keyboard.
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.container,
          // `spacing`, not `gap`: the rows are labelled sections rather than
          // controls in a group, and want more air between them than the
          // theme's in-group gap gives.
          { gap: theme.spacing, padding: theme.spacing },
        ]}
        keyboardShouldPersistTaps="handled"
        // A subtask row is added and autofocused in one go, so it has to be on
        // screen before the user types. Subtasks are the last field, making the
        // end of the content the right target; keying off the content size
        // (rather than scrolling from the tap) waits for the new row to lay
        // out, so the scroll can't run against a stale height.
        onContentSizeChange={() => {
          if (!pendingScroll.current) return;
          pendingScroll.current = false;
          scrollRef.current?.scrollToEnd({ animated: true });
        }}
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
          <ClearableDateField
            field="schedule"
            value={form.scheduledFor}
            onChange={handleChangeSchedule}
          />
        </FormRow>

        <FormRow label="Deadline" minHeight={32}>
          <ClearableDateField
            field="deadline"
            value={form.dueOn}
            onChange={form.setDueOn}
          />
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
                  // Bound to now only when the task is scheduled for today, so a
                  // same-day alarm can't be set in the past; a future day allows
                  // any time.
                  min={
                    form.scheduledFor === Temporal.Now.plainDateISO().toString()
                      ? currentAlarmTime()
                      : undefined
                  }
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

        <SubtaskFields
          value={form.subtasks}
          onChange={form.setSubtasks}
          makeRow={(id) => ({ id, title: "", status: ETaskStatus.TODO })}
          onAddRow={() => {
            pendingScroll.current = true;
          }}
          testIDPrefix="new-task"
        />
      </ScrollView>
    </ModalScreen>
  );
}

type TClearableDateFieldProps = {
  /** Names the row: drives both the "Add …" copy and the testIDs. */
  field: "schedule" | "deadline";
  value: string | null;
  onChange: (value: string | null) => void;
};

/**
 * A date the form can also *not* have: the picker plus a Clear that empties it,
 * collapsing to an "Add …" button that seeds today. Shared by Schedule and
 * Deadline, which differ only in their copy and testIDs.
 */
function ClearableDateField({
  field,
  value,
  onChange,
}: TClearableDateFieldProps) {
  const theme = useTheme();

  if (value === null) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        testID={`new-task-add-${field}`}
        onPress={() => onChange(Temporal.Now.plainDateISO().toString())}
      >
        <Text style={[styles.labelDetail, { color: theme.colors.primary }]}>
          Add {field}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.dateControls, { gap: theme.gap }]}>
      <DateField
        accentColor={theme.colors.primary}
        testID={`new-task-${field}`}
        value={plainDateISOToDate(value)}
        onChange={(date) => onChange(dateToPlainDateISO(date))}
      />
      <TouchableOpacity
        accessibilityRole="button"
        testID={`new-task-clear-${field}`}
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
  dateControls: {
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
