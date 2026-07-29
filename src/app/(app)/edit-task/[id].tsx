import { useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { Alert, Platform, ScrollView } from "react-native";

import { TTask } from "@/api/tasks";
import { DismissModal } from "@/components/DismissModal";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ModalErrorScreen } from "@/components/ModalErrorScreen";
import { ModalScreen } from "@/components/ModalScreen";
import { TaskForm } from "@/components/TaskForm";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useDismissModal } from "@/hooks/useDismissModal";
import { useLists } from "@/hooks/useLists";
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
  const [tasks, { isError, isLoading, refetch }] = useTasks();

  const task = tasks.find((candidate) => candidate.id === id);

  // Resolving the task wins over every other state: a background refetch that
  // fails after a successful load leaves the cache populated, and the form the
  // user is typing into must survive that.
  if (task) {
    // The `key` remounts the form if the resolved task changes, so the fields
    // can't carry one task's edits onto another.
    return <EditTaskForm key={task.id} task={task} />;
  }

  // Still fetching: wait for the task so the form initializes from its saved
  // values.
  if (isLoading) return <LoadingScreen />;

  // The fetch failed, which is not the same as "there is no such task" — say
  // so and offer the retry rather than throwing the user out (DEX-100).
  if (isError) {
    return <TasksUnavailable onRetry={refetch} />;
  }

  // Loaded, with no match: a deleted task, a stale deep link, or a row that
  // aged out of the canonical window. Close the modal rather than navigating
  // the whole app, so whatever it was opened over survives.
  return <DismissModal fallback="/" />;
}

function TasksUnavailable({ onRetry }: { onRetry: () => void }) {
  const dismiss = useDismissModal("/");

  return (
    <ModalErrorScreen
      message="Couldn't load your tasks. Check your connection and try again."
      onClose={dismiss}
      onRetry={onRetry}
    />
  );
}

function EditTaskForm({ task }: { task: TTask }) {
  const [lists] = useLists();
  const [, { updateTask }] = useTasks({ skipQuery: true });
  const form = useTaskForm(lists, { task });
  const hasSaved = useRef(false);
  const { scrollViewProps, scrollToEndOnNextLayout } = useTaskFormScroll();
  const handleClose = useDismissModal("/");

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
