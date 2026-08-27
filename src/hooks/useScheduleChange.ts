import { useCallback } from "react";

import { TTask, TUpdateTask } from "@/api/tasks";
import { useConfirmation } from "@/hooks/useConfirmation";

// Applies the resolved change. Already keyed by task id, so useTasks'
// updateTask can be passed straight in.
type TScheduleUpdate = (update: TUpdateTask) => void;

// The one path scheduledFor should change through (DEX-77) — an alarm fires
// at that date. `== null` treats an absent alarmTime as "no alarm" (DEX-48).
export function useScheduleChange(onUpdate: TScheduleUpdate) {
  const { confirm, confirmationProps } = useConfirmation();

  const changeSchedule = useCallback(
    async (task: TTask, scheduledFor: string | null) => {
      if (task.alarmTime == null || scheduledFor === task.scheduledFor) {
        onUpdate({ id: task.id, scheduledFor });
        return;
      }

      if (scheduledFor === null) {
        // Unscheduling removes the date the alarm needs to fire, so keeping it
        // isn't an option — only unset-or-cancel.
        const confirmed = await confirm({
          title: "Unschedule task?",
          message:
            "This task has an alarm set. Unscheduling it will unset the alarm.",
          confirmLabel: "Unschedule",
          destructive: true,
        });
        if (confirmed) {
          onUpdate({ id: task.id, scheduledFor: null, alarmTime: null });
        }
        return;
      }

      // Moving to another day: let the user carry the alarm to the new day (same
      // time) or drop it. Each choice applies itself; Cancel leaves the task as-is.
      await confirm({
        title: "Reschedule task?",
        message:
          "This task has an alarm set. Keep the alarm on the new day, or unset it?",
        actions: [
          {
            label: "Keep alarm",
            role: "default",
            onPress: () => onUpdate({ id: task.id, scheduledFor }),
          },
          {
            label: "Unset alarm",
            role: "destructive",
            onPress: () =>
              onUpdate({ id: task.id, scheduledFor, alarmTime: null }),
          },
          { label: "Cancel", role: "cancel" },
        ],
      });
    },
    [confirm, onUpdate],
  );

  return { changeSchedule, confirmationProps };
}
