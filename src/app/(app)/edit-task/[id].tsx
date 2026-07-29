import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useRef } from "react";
import { ScrollView } from "react-native";

import { TTask } from "@/api/tasks";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ModalScreen } from "@/components/ModalScreen";
import { TaskForm } from "@/components/TaskForm";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useLists } from "@/hooks/useLists";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";
import { useTaskForm } from "@/hooks/useTaskForm";
import { useTaskFormScroll } from "@/hooks/useTaskFormScroll";
import { useTasks } from "@/hooks/useTasks";
import { showSaveError } from "@/utils/showSaveError";

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
  const router = useRouter();
  const [lists] = useLists();
  const [, { updateTask }] = useTasks({ skipQuery: true });
  const form = useTaskForm(lists, { task });
  const hasSaved = useRef(false);
  const { scrollViewProps, scrollToEndOnNextLayout } = useTaskFormScroll();

  // Pops rather than navigating, so whatever the modal was opened over stays
  // put. The guard covers the one case a push can't: a cold deep link straight
  // to `/edit-task/<id>`, which leaves the stack holding only this screen — and
  // an unguarded `back()` there is an unhandled `GO_BACK` that makes ✕ look
  // dead and leaves ✓ writing the update without ever closing.
  const handleClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

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
