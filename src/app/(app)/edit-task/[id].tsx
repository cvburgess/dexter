import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useRef } from "react";
import { Alert, Platform, ScrollView, StyleSheet } from "react-native";

import { TTask } from "@/api/tasks";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ModalScreen } from "@/components/ModalScreen";
import { TaskForm } from "@/components/TaskForm";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useLists } from "@/hooks/useLists";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { useTaskForm } from "@/hooks/useTaskForm";
import { useTasks } from "@/hooks/useTasks";
import { useTheme } from "@/utils/theme";

// RN's Alert is a no-op on web, so fall back to the browser's alert there.
const showSaveError = () => {
  const message = "We couldn't save your task. Please try again.";

  if (Platform.OS === "web") {
    window.alert(message);
  } else {
    Alert.alert("Something went wrong", message);
  }
};

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tasks, { isLoading }] = useTasks();

  const task = tasks.find((candidate) => candidate.id === id);

  if (!task) {
    // Still fetching: wait for the task so the form initializes from its saved
    // values. Once loaded with no match (a deleted task, a stale deep link),
    // the id is invalid — bail back to the app rather than spin forever.
    return isLoading ? <LoadingScreen /> : <Redirect href="/" />;
  }

  // The `key` remounts the form if the resolved task changes, so the fields
  // can't carry one task's edits onto another.
  return <EditTaskForm key={task.id} task={task} />;
}

function EditTaskForm({ task }: { task: TTask }) {
  const theme = useTheme();
  const router = useRouter();
  const [lists] = useLists();
  const [, { updateTask }] = useTasks({ skipQuery: true });
  const form = useTaskForm(lists, { task });
  const hasSaved = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  // Set when a subtask row is added, consumed by the next content size change.
  const pendingScroll = useRef(false);

  const handleClose = () => router.back();

  // One-shot, like the create modal: a double tap can't fire two writes. The
  // whole field set goes in one `updateTask` — `goalId` and `status` are not on
  // this form, so they are absent from the payload and left untouched.
  const handleSave = () => {
    if (hasSaved.current || !form.canSave) return;
    hasSaved.current = true;
    updateTask(
      { id: task.id, ...form.task },
      {
        onSuccess: handleClose,
        onError: () => {
          hasSaved.current = false;
          showSaveError();
        },
      },
    );
  };

  useModalHeaderActions({
    canSave: form.canSave,
    onClose: handleClose,
    onSave: handleSave,
  });

  return (
    <ModalScreen>
      <WebModalHeader
        isDisabled={!form.canSave}
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
        // screen before the user types (see new-task's copy of this).
        onContentSizeChange={() => {
          if (!pendingScroll.current) return;
          pendingScroll.current = false;
          scrollRef.current?.scrollToEnd({ animated: true });
        }}
        style={{ backgroundColor: theme.colors.background }}
      >
        {/* No `autoFocus`: the form opens already filled, so raising the
            keyboard would only cover the fields the user came to change. */}
        <TaskForm
          form={form}
          lists={lists}
          testIDPrefix="edit-task"
          onSubmit={handleSave}
          onAddSubtaskRow={() => {
            pendingScroll.current = true;
          }}
        />
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
});
