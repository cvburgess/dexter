import { useCallback } from "react";

import { TTask } from "@/api/tasks";
import { isRepeatTask } from "@/api/templates";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";

// Deleting a task, with the confirmation its repeat schedule needs (DEX-21,
// DEX-146). Unknown/stale template state reads as "not a repeat" (safer).
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
