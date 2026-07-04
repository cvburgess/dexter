import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Host, Picker } from "@expo/ui";

import { Button } from "@/components/Button";
import { DateField } from "@/components/DateField";
import { PriorityControl } from "@/components/PriorityControl";
import { TextInput } from "@/components/TextInput";
import { useLists } from "@/hooks/useLists";
import { useNewTaskForm } from "@/hooks/useNewTaskForm";
import { useTasks } from "@/hooks/useTasks";
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

export default function NewTaskScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [lists] = useLists();
  const [, { createTask }] = useTasks({ skipQuery: true });
  const form = useNewTaskForm(lists);

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
        <PriorityControl
          priority={form.priority}
          onChangePriority={form.setPriority}
        />
      </View>

      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.colors.text }]}>List</Text>
        <Host matchContents>
          <Picker
            appearance="menu"
            selectedValue={form.listId ?? NO_LIST}
            testID="new-task-list"
            onValueChange={(listId) =>
              form.setListId(listId === NO_LIST ? null : String(listId))
            }
          >
            <Picker.Item label="None" value={NO_LIST} />
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
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Schedule
        </Text>
        <DateField
          accentColor={theme.colors.primary}
          testID="new-task-schedule"
          value={plainDateToDate(form.scheduledFor)}
          onChange={(date) => form.setScheduledFor(dateToPlainDateISO(date))}
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
            <DateField
              accentColor={theme.colors.primary}
              testID="new-task-deadline"
              value={plainDateToDate(form.dueOn)}
              onChange={(date) => form.setDueOn(dateToPlainDateISO(date))}
            />
            <TouchableOpacity
              accessibilityRole="button"
              testID="new-task-clear-deadline"
              onPress={() => form.setDueOn(null)}
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
