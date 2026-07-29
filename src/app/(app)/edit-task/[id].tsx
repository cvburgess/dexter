import { Href, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { ScrollView } from "react-native";

import { TTask } from "@/api/tasks";
import { DismissModal } from "@/components/DismissModal";
import {
  loadFailedMessage,
  ModalErrorScreen,
} from "@/components/ModalErrorScreen";
import { ModalLoadingScreen } from "@/components/ModalLoadingScreen";
import { ModalScreen } from "@/components/ModalScreen";
import { TaskForm } from "@/components/TaskForm";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useDismissModal } from "@/hooks/useDismissModal";
import { useLists } from "@/hooks/useLists";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { useTaskForm } from "@/hooks/useTaskForm";
import { useTaskFormScroll } from "@/hooks/useTaskFormScroll";
import { useTasks } from "@/hooks/useTasks";
import { showSaveError } from "@/utils/showSaveError";

/** Where this modal returns to when it can't just pop — one value, because a
 * stale link and a ✕ have to land in the same place. */
const HOME: Href = "/";

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
  if (isLoading) return <ModalLoadingScreen fallback={HOME} />;

  // The fetch failed, which is not the same as "there is no such task" — say
  // so and offer the retry rather than throwing the user out (DEX-100).
  if (isError) {
    return (
      <ModalErrorScreen
        fallback={HOME}
        message={loadFailedMessage("tasks")}
        onRetry={refetch}
      />
    );
  }

  // Loaded, with no match: a deleted task, a stale deep link, or a row that
  // aged out of the canonical window. Close the modal rather than navigating
  // the whole app, so whatever it was opened over survives.
  return <DismissModal fallback={HOME} />;
}

function EditTaskForm({ task }: { task: TTask }) {
  const [lists] = useLists();
  const [, { updateTask }] = useTasks({ skipQuery: true });
  const form = useTaskForm(lists, { task });
  const hasSaved = useRef(false);
  const { scrollViewProps, scrollToEndOnNextLayout } = useTaskFormScroll();
  const handleClose = useDismissModal(HOME);

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
          showSaveError("task");
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
