import { useCallback } from "react";

import { TTask } from "@/api/tasks";
import { isRepeatTask } from "@/api/templates";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";

/**
 * Deleting a task, with the confirmation its repeat schedule needs (DEX-21).
 *
 * Extracted from `DayTaskList` for the ritual's Open tasks step (DEX-146), which
 * offers the card's own Delete row against the same tasks: a second call site
 * that deleted straight through `useTasks` would leave a repeating task's
 * schedule behind and quietly re-create the task tomorrow, which is the exact
 * failure the branch below exists to prevent.
 *
 * A linked template is only *this task's* repeat schedule while it still carries
 * one. Since DEX-65 it may instead have been converted into a saved task
 * template — which belongs to the user, not to this task, and must outlive it.
 * Unknown (still loading, or a stale id) counts as "not a repeat": leaving a
 * schedule behind is visible and undoable in Settings, whereas deleting a
 * template the user saved is neither.
 *
 * @returns `confirmDelete` — awaitable; resolves once the user has answered and
 *   the delete (if any) has been issued.
 * @returns `confirmationProps` — spread onto a single `<ConfirmationModal />` by
 *   the consuming component.
 */
export function useTaskDelete() {
  const { confirm, confirmationProps } = useConfirmation();
  const [, { deleteTask }] = useTasks();
  const [, { deleteTemplate, getTemplateById }] = useTemplates();

  const confirmDelete = useCallback(
    async (task: TTask) => {
      const linkedTemplate = getTemplateById(task.templateId);
      const isRepeating = linkedTemplate ? isRepeatTask(linkedTemplate) : false;
      const confirmed = await confirm({
        title: isRepeating ? "Delete repeating task?" : "Delete Task",
        message: isRepeating
          ? "This task repeats. Deleting it also removes its repeat schedule, so no new occurrences will be created."
          : "Delete this task?",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (!confirmed) return;
      // The task→template FK is ON DELETE SET NULL, so the template must be
      // removed explicitly to stop future occurrences (DEX-21).
      if (isRepeating && task.templateId) deleteTemplate(task.templateId);
      deleteTask(task.id);
    },
    [confirm, deleteTask, deleteTemplate, getTemplateById],
  );

  return { confirmDelete, confirmationProps };
}
