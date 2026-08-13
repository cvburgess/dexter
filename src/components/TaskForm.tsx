import { Temporal } from "@js-temporal/polyfill";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TList } from "@/api/lists";
import { ETaskStatus } from "@/api/tasks";
import { DateField } from "@/components/DateField";
import { FormRow } from "@/components/FormRow";
import { PickerField } from "@/components/PickerField";
import { PriorityControl } from "@/components/PriorityControl";
import { SubtaskFields } from "@/components/SubtaskFields";
import { TextInput } from "@/components/TextInput";
import { TimeField } from "@/components/TimeField";
import { TTaskForm } from "@/hooks/useTaskForm";
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

type TTaskFormProps = {
  form: TTaskForm;
  lists: TList[];
  /**
   * Focuses the title on mount. Create opens on an empty form where typing is
   * the whole point; edit opens on a filled one where raising the keyboard
   * would just cover the fields the user came for (DEX-98).
   */
  autoFocus?: boolean;
  /** Fired by the keyboard's return key — the caller's save handler. */
  onSubmit: () => void;
  /** Lets the host scroll a newly added subtask row into view. */
  onAddSubtaskRow?: () => void;
  /** Namespaces every testID, so the two screens' fields stay distinguishable. */
  testIDPrefix: string;
};

/**
 * Every field a task carries, in one form: title, priority, list, schedule,
 * deadline, alarm (iOS only), link, and checklist. Shared verbatim by the create
 * modal (`new-task`) and the edit modal (`edit-task/[id]`) — the two differ only
 * in what wraps it and what ✓ writes, never in the fields themselves.
 *
 * Layout (the `ScrollView`, the segmented control, the template picker) belongs
 * to the host screen; this renders the fields and nothing around them.
 */
export function TaskForm({
  form,
  lists,
  autoFocus,
  onSubmit,
  onAddSubtaskRow,
  testIDPrefix,
}: TTaskFormProps) {
  const theme = useTheme();

  // An alarm fires on the task's scheduled day, so the two move together (the
  // rule TaskCard already applies to saved tasks): unscheduling drops the
  // alarm, and setting one on an unscheduled task pulls it onto today. No
  // confirmation in either mode — nothing is saved until ✓, and the Alarm row
  // visibly reverting to "Add alarm" is the feedback.
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

  // Bound the picker to now only when the task is scheduled for today, so a
  // same-day alarm can't be *set* in the past; a future day allows any time.
  //
  // Dropped entirely when the alarm the form already carries is earlier than
  // that bound. Editing opens on a saved alarm (create never can — it seeds
  // `defaultAlarmTime()`, which is always ahead of now), and an 08:00 alarm on
  // a task scheduled today is in the past by lunchtime. A range that excludes
  // the current selection makes SwiftUI's `DatePicker` clamp it — and write the
  // clamped value back through the binding — so merely opening the edit modal
  // would move the alarm to now and ✓ would persist it. Web's
  // `input[type=time]` is less destructive but still marks the value invalid.
  const minAlarmTime =
    form.scheduledFor === Temporal.Now.plainDateISO().toString()
      ? currentAlarmTime()
      : undefined;
  // Lexicographic compare is safe: both are zero-padded 24-hour times, and a
  // stored `"HH:MM:SS"` still orders correctly against a `"HH:MM"` bound.
  const alarmMin =
    minAlarmTime !== undefined &&
    form.alarmTime !== null &&
    form.alarmTime < minAlarmTime
      ? undefined
      : minAlarmTime;

  return (
    <>
      <TextInput
        autoFocus={autoFocus}
        placeholder="What needs to be done?"
        returnKeyType="done"
        testID={`${testIDPrefix}-title`}
        value={form.title}
        onChangeText={form.setTitle}
        onSubmitEditing={onSubmit}
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
        testID={`${testIDPrefix}-list`}
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
          testIDPrefix={testIDPrefix}
          value={form.scheduledFor}
          onChange={handleChangeSchedule}
        />
      </FormRow>

      <FormRow label="Deadline" minHeight={32}>
        <ClearableDateField
          field="deadline"
          testIDPrefix={testIDPrefix}
          value={form.dueOn}
          onChange={form.setDueOn}
        />
      </FormRow>

      {isAlarmSupported && (
        <FormRow label="Alarm" minHeight={32}>
          {form.alarmTime === null ? (
            <TouchableOpacity
              accessibilityRole="button"
              testID={`${testIDPrefix}-add-alarm`}
              onPress={handleAddAlarm}
            >
              <Text style={[theme.fonts.body, { color: theme.colors.primary }]}>
                Add alarm
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.alarmControls, { gap: theme.space.sm }]}>
              <TimeField
                accentColor={theme.colors.primary}
                testID={`${testIDPrefix}-alarm`}
                min={alarmMin}
                value={form.alarmTime}
                onChange={form.setAlarmTime}
              />
              <TouchableOpacity
                accessibilityRole="button"
                testID={`${testIDPrefix}-clear-alarm`}
                onPress={() => form.setAlarmTime(null)}
              >
                <Text
                  style={[
                    theme.fonts.body,
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

      <FormRow label="Link" minHeight={32}>
        {/* The input sizes to this wrapper rather than to itself: `TextInput`
            carries `width: "100%"`, which in a space-between row would push the
            label off the edge. */}
        <View style={[styles.linkField, { marginLeft: theme.space.md }]}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://…"
            returnKeyType="done"
            testID={`${testIDPrefix}-url`}
            value={form.url}
            onChangeText={form.setUrl}
            onSubmitEditing={onSubmit}
          />
        </View>
      </FormRow>

      <SubtaskFields
        value={form.subtasks}
        onChange={form.setSubtasks}
        makeRow={(id) => ({ id, title: "", done: false })}
        onAddRow={onAddSubtaskRow}
        testIDPrefix={testIDPrefix}
      />
    </>
  );
}

type TClearableDateFieldProps = {
  /** Names the row: drives both the "Add …" copy and the testIDs. */
  field: "schedule" | "deadline";
  testIDPrefix: string;
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
  testIDPrefix,
  value,
  onChange,
}: TClearableDateFieldProps) {
  const theme = useTheme();

  if (value === null) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        testID={`${testIDPrefix}-add-${field}`}
        onPress={() => onChange(Temporal.Now.plainDateISO().toString())}
      >
        <Text style={[theme.fonts.body, { color: theme.colors.primary }]}>
          Add {field}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.dateControls, { gap: theme.space.sm }]}>
      <DateField
        accentColor={theme.colors.primary}
        testID={`${testIDPrefix}-${field}`}
        value={plainDateISOToDate(value)}
        onChange={(date) => onChange(dateToPlainDateISO(date))}
      />
      <TouchableOpacity
        accessibilityRole="button"
        testID={`${testIDPrefix}-clear-${field}`}
        onPress={() => onChange(null)}
      >
        <Text style={[theme.fonts.body, { color: theme.colors.textSecondary }]}>
          Clear
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  dateControls: {
    alignItems: "center",
    flexDirection: "row",
  },
  alarmControls: {
    alignItems: "center",
    flexDirection: "row",
  },
  linkField: {
    flex: 1,
  },
});
