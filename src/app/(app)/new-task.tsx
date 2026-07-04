import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { Picker } from "@expo/ui/community/picker";
import { SegmentedControl } from "@expo/ui/community/segmented-control";

import { ETaskPriority } from "@/api/tasks";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { useLists } from "@/hooks/useLists";
import { useNewTaskForm } from "@/hooks/useNewTaskForm";
import { useTasks } from "@/hooks/useTasks";
import { useTheme } from "@/utils/theme";

/**
 * Segments mirror the shorthand tokens (`!` = Urgent … `!!!!` = Neither) so
 * the control doubles as a legend for the syntax.
 */
const PRIORITY_SEGMENTS: { label: string; name: string; value: ETaskPriority }[] =
  [
    { label: "None", name: "Unprioritized", value: ETaskPriority.UNPRIORITIZED },
    { label: "!", name: "Urgent", value: ETaskPriority.URGENT },
    { label: "!!", name: "Important", value: ETaskPriority.IMPORTANT },
    {
      label: "!!!",
      name: "Important & Urgent",
      value: ETaskPriority.IMPORTANT_AND_URGENT,
    },
    { label: "!!!!", name: "Neither", value: ETaskPriority.NEITHER },
  ];

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

export default function NewTaskScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [lists] = useLists();
  const [, { createTask }] = useTasks({ skipQuery: true });
  const form = useNewTaskForm(lists);

  const selectedSegment = PRIORITY_SEGMENTS.findIndex(
    (segment) => segment.value === form.priority,
  );

  const handleSave = () => {
    createTask(form.task);
    router.back();
  };

  return (
    <ScrollView
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
        onSubmitEditing={() => {
          if (form.canSave) handleSave();
        }}
      />

      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Priority
        </Text>
        <Text style={[styles.labelDetail, { color: theme.colors.textSecondary }]}>
          {PRIORITY_SEGMENTS[selectedSegment].name}
        </Text>
      </View>
      <SegmentedControl
        selectedIndex={selectedSegment}
        testID="new-task-priority"
        tintColor={theme.colors.primary}
        values={PRIORITY_SEGMENTS.map((segment) => segment.label)}
        onChange={(event) => {
          form.setPriority(
            PRIORITY_SEGMENTS[event.nativeEvent.selectedSegmentIndex].value,
          );
        }}
      />

      <Text style={[styles.label, { color: theme.colors.text }]}>List</Text>
      <Picker
        selectedValue={form.listId}
        testID="new-task-list"
        onValueChange={(listId) => form.setListId(listId)}
      >
        <Picker.Item label="None" value={null} />
        {lists.map((list) => (
          <Picker.Item
            key={list.id}
            label={`${list.emoji} ${list.title}`}
            value={list.id}
          />
        ))}
      </Picker>

      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Schedule
        </Text>
        <DateTimePicker
          accentColor={theme.colors.primary}
          mode="date"
          testID="new-task-schedule"
          value={plainDateToDate(form.scheduledFor)}
          onValueChange={(_event, date) =>
            form.setScheduledFor(dateToPlainDateISO(date))
          }
        />
      </View>

      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Deadline
        </Text>
        {form.dueOn === null ? (
          <TouchableOpacity
            accessibilityRole="button"
            testID="new-task-add-deadline"
            onPress={() =>
              form.setDueOn(Temporal.Now.plainDateISO().toString())
            }
          >
            <Text style={[styles.labelDetail, { color: theme.colors.primary }]}>
              Add deadline
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.deadlineControls, { gap: theme.gap }]}>
            <TouchableOpacity
              accessibilityRole="button"
              testID="new-task-clear-deadline"
              onPress={() => form.setDueOn(null)}
            >
              <Text
                style={[styles.labelDetail, { color: theme.colors.textSecondary }]}
              >
                Clear
              </Text>
            </TouchableOpacity>
            <DateTimePicker
              accentColor={theme.colors.primary}
              mode="date"
              testID="new-task-deadline"
              value={plainDateToDate(form.dueOn)}
              onValueChange={(_event, date) =>
                form.setDueOn(dateToPlainDateISO(date))
              }
            />
          </View>
        )}
      </View>

      <Button
        disabled={!form.canSave}
        testID="new-task-save"
        variant="primary"
        onPress={handleSave}
      >
        Save
      </Button>
    </ScrollView>
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
    minHeight: 32,
  },
});
