import { Temporal } from "@js-temporal/polyfill";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TList } from "@/api/lists";
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
  /** Focuses the title on mount — create opens empty for typing; edit opens
   * filled, where the keyboard would just cover the fields (DEX-98). */
  autoFocus?: boolean;
  /** Fired by the keyboard's return key — the caller's save handler. */
  onSubmit: () => void;
  /** Lets the host scroll a newly added subtask row into view. */
  onAddSubtaskRow?: () => void;
  /** Namespaces every testID, so the two screens' fields stay distinguishable. */
  testIDPrefix: string;
};

// Shared verbatim by create and edit modals, which differ only in what wraps
// it and what ✓ writes. Layout belongs to the host screen; this renders fields only.
export function TaskForm({
  form,
  lists,
  autoFocus,
  onSubmit,
  onAddSubtaskRow,
  testIDPrefix,
}: TTaskFormProps) {
  const theme = useTheme();

  // An alarm fires on the scheduled day, so the two move together (TaskCard's
  // rule): unscheduling drops it, setting one pulls the task onto today.
  const handleChangeSchedule = (scheduledFor: string | null) => {
    form.setScheduledFor(scheduledFor);
    if (scheduledFor === null) form.setAlarmTime(null);
  };

  // A denied AlarmKit request is surfaced rather than silently seeding an
  // alarm that won't fire (mirrors TaskCard.handleConfirmAlarm — DEX-48).
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

  // Bounds the picker to now for today only, dropped if the saved alarm is
  // already earlier — else SwiftUI's DatePicker clamps and writes it back.
  const minAlarmTime =
    form.scheduledFor === Temporal.Now.plainDateISO().toString()
      ? currentAlarmTime()
      : undefined;
  // Lexicographic compare is safe — zero-padded 24-hour times order correctly
  // even across "HH:MM:SS" vs "HH:MM".
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
          seed={form.anchorDate}
          testIDPrefix={testIDPrefix}
          value={form.scheduledFor}
          onChange={handleChangeSchedule}
        />
      </FormRow>

      <FormRow label="Deadline" minHeight={32}>
        <ClearableDateField
          field="deadline"
          seed={form.anchorDate}
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
        {/* TextInput carries width: "100%", which in a space-between row
            would push the label off the edge without this wrapper. */}
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
  /** ISO date the "Add …" button fills the empty row with. */
  seed: string;
  testIDPrefix: string;
  value: string | null;
  onChange: (value: string | null) => void;
};

// A date the form can also not have: picker + Clear, collapsing to an "Add …"
// button seeded from `seed`. Shared by Schedule and Deadline.
function ClearableDateField({
  field,
  seed,
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
        onPress={() => onChange(seed)}
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
