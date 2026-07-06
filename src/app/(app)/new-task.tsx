import { Temporal } from "@js-temporal/polyfill";
import { useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Host, Picker } from "@expo/ui";

import { DateField } from "@/components/DateField";
import { CloseButton, DoneButton } from "@/components/ModalHeaderButtons";
import { PriorityControl } from "@/components/PriorityControl";
import { TextInput } from "@/components/TextInput";
import { WebModalHeader } from "@/components/WebModalHeader";
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
  const navigation = useNavigation();
  const router = useRouter();
  const [lists, { isLoading: isLoadingLists }] = useLists();
  const [, { createTask }] = useTasks({ skipQuery: true });
  const form = useNewTaskForm(lists);
  const hasSaved = useRef(false);

  // Saving waits for lists so `#list` tokens in the title can resolve, and
  // is one-shot so a double tap can't create duplicate tasks.
  const canSave = form.canSave && !isLoadingLists;

  const handleClose = () => router.back();

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

  // No dependency array: the handlers close over the latest form state, so
  // the header must be re-wired on every render.
  useLayoutEffect(() => {
    navigation.setOptions({
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
              <Text
                style={[styles.labelDetail, { color: theme.colors.primary }]}
              >
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
      </ScrollView>
    </>
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
