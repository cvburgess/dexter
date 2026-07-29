import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text } from "react-native";

import { isTaskTemplate } from "@/api/templates";
import { ModalScreen } from "@/components/ModalScreen";
import {
  SegmentedControl,
  TSegmentedControlOption,
} from "@/components/SegmentedControl";
import { TaskForm } from "@/components/TaskForm";
import { TemplatePicker } from "@/components/TemplatePicker";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useLists } from "@/hooks/useLists";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { useTaskForm } from "@/hooks/useTaskForm";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { useTheme } from "@/utils/theme";

/**
 * Where the task's starting point comes from: nothing, a saved template, or
 * (eventually) a spoken description. AI is a deliberate placeholder — the tab
 * exists so the shape of the modal is settled before the feature lands.
 */
type TNewTaskMode = "new" | "template" | "ai";

const MODE_OPTIONS: TSegmentedControlOption<TNewTaskMode>[] = [
  { value: "new", label: "New" },
  { value: "template", label: "Template" },
  { value: "ai", label: "AI" },
];

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
  const [allTemplates, { isLoading: isLoadingTemplates }] = useTemplates();
  // Set by NewTaskButton to the day the user was viewing; absent → today.
  const { scheduledFor } = useLocalSearchParams<{ scheduledFor?: string }>();
  const form = useTaskForm(lists, { defaultScheduledFor: scheduledFor });
  const [mode, setMode] = useState<TNewTaskMode>("new");
  const hasSaved = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  // Set when a subtask row is added, consumed by the next content size change.
  const pendingScroll = useRef(false);

  // Repeat tasks share the templates table; only the scheduleless rows are
  // blueprints a new task can start from.
  const templates = allTemplates.filter(isTaskTemplate);

  // Saving waits for lists so `#list` tokens in the title can resolve, and
  // is one-shot so a double tap can't create duplicate tasks. The AI tab has no
  // form behind it yet, so there is nothing there to save.
  const canSave = form.canSave && !isLoadingLists && mode !== "ai";

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
        <SegmentedControl
          options={MODE_OPTIONS}
          testIDPrefix="new-task-mode"
          value={mode}
          onChange={setMode}
        />

        {/* Selecting is not saving: the template seeds the form below and the
            user can still edit anything before the task is created. The form
            holds the selection, so the outlined card and the task's
            `template_id` can never disagree. */}
        {mode === "template" && (
          <TemplatePicker
            templates={templates}
            selectedId={form.templateId}
            isLoading={isLoadingTemplates}
            onSelect={form.applyTemplate}
          />
        )}

        {mode === "ai" ? (
          <Text
            style={[styles.placeholder, { color: theme.colors.textSecondary }]}
            testID="new-task-ai-placeholder"
          >
            Coming soon: describe a task out loud and Dexter will fill this in
            for you.
          </Text>
        ) : (
          <TaskForm
            autoFocus
            form={form}
            lists={lists}
            testIDPrefix="new-task"
            onSubmit={handleSave}
            onAddSubtaskRow={() => {
              pendingScroll.current = true;
            }}
          />
        )}
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  placeholder: {
    fontSize: 14,
    paddingVertical: 8,
  },
});
