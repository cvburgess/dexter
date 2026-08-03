import { useCallback } from "react";

import { TTask, TUpdateTask } from "@/api/tasks";
import { useConfirmation } from "@/hooks/useConfirmation";

/**
 * Applies the resolved change. Already keyed by task id, so `useTasks`'
 * `updateTask` can be passed straight in.
 */
type TScheduleUpdate = (update: TUpdateTask) => void;

/**
 * The one path a task's `scheduledFor` should change through (DEX-77).
 *
 * An alarm is bound to the task's scheduled date (it fires at `scheduled_for` +
 * `alarm_time`), so moving that date shouldn't silently move or orphan the
 * alarm — ask first. Extracted from `TaskCard` so every surface that
 * reschedules shares the prompt: the card's own long-press menu, the backlog's
 * "+" button, and the large-screen drag-to-schedule drop targets. Before this
 * hook existed the "+" called `updateTask` directly and skipped the prompt
 * entirely, which is why a backlog task with an alarm could be scheduled onto a
 * new day with its alarm left pointing at the old one.
 *
 * A re-tap of the current day changes nothing, and a task without an alarm just
 * reschedules. `== null` (not `===`) so a task whose `alarmTime` is absent
 * rather than null — e.g. a DB missing the column — still counts as "no alarm"
 * and reschedules directly instead of prompting (DEX-48).
 *
 * @returns `changeSchedule` — awaitable; resolves once the user has answered.
 *   Memoized on `onUpdate`, which means it is only as stable as the updater it
 *   is handed. `useTasks`' `updateTask` is a bare arrow rebuilt every render, so
 *   in practice this changes identity on every render too — a caller that needs
 *   a stable identity has to hold it in a ref (`DragScheduleProvider` does).
 * @returns `confirmationProps` — spread onto a single `<ConfirmationModal />`
 *   by the consuming component.
 */
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
