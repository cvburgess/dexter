import { Redirect, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { Alert, Platform, ScrollView } from "react-native";

import { TTask } from "@/api/tasks";
import { ModalLoadingScreen } from "@/components/ModalLoadingScreen";
import { ModalScreen } from "@/components/ModalScreen";
import { TaskForm } from "@/components/TaskForm";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useLists } from "@/hooks/useLists";
import { useModalClose } from "@/hooks/useModalClose";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { useTaskForm } from "@/hooks/useTaskForm";
import { useTaskFormScroll } from "@/hooks/useTaskFormScroll";
import { useTasks } from "@/hooks/useTasks";

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
    // values. The wait carries its own header — the form's is the only one on
    // web, so a bare spinner would have no ✕ (DEX-101). Once loaded with no
    // match (a deleted task, a stale deep link), the id is invalid — bail back
    // to the app rather than spin forever.
    return isLoading ? (
      <ModalLoadingScreen closeFallback="/" />
    ) : (
      <Redirect href="/" />
    );
  }

  // The `key` remounts the form if the resolved task changes, so the fields
  // can't carry one task's edits onto another.
  return <EditTaskForm key={task.id} task={task} />;
}

function EditTaskForm({ task }: { task: TTask }) {
  const [lists] = useLists();
  const [, { updateTask }] = useTasks({ skipQuery: true });
  const form = useTaskForm(lists, { task });
  const hasSaved = useRef(false);
  const { scrollViewProps, scrollToEndOnNextLayout } = useTaskFormScroll();
  const handleClose = useModalClose("/");

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
      <ScrollView {...scrollViewProps}>
        {/* No `autoFocus`: the form opens already filled, so raising the
            keyboard would only cover the fields the user came to change. */}
        <TaskForm
          form={form}
          lists={lists}
          testIDPrefix="edit-task"
          onSubmit={handleSave}
          onAddSubtaskRow={scrollToEndOnNextLayout}
        />
      </ScrollView>
    </ModalScreen>
  );
}
