import { useEffect, useRef } from "react";

import {
  cancelTaskAlarm,
  getScheduledAlarmIds,
  reconcileAlarms,
  scheduleTaskAlarm,
} from "@/utils/alarms";

import { useTasks } from "./useTasks";

/**
 * Keeps native iOS AlarmKit alarms in sync with the task list. Rather than
 * scheduling imperatively at each tap, this reconciles the alarms that *should*
 * exist (tasks with an alarm time, still open, whose moment is in the future)
 * against the ones AlarmKit already holds — scheduling new/edited alarms and
 * cancelling stale ones. That makes complete / delete / reschedule / unschedule
 * and background-created repeat occurrences all self-heal, and it re-projects
 * DB state onto AlarmKit on every launch (DEX-48).
 *
 * The alarm id is the task id (a 1:1 mapping). No-ops off iOS via `utils/alarms`.
 * Mounted once, high in the authenticated tree.
 */
export const useAlarmSync = (): void => {
  const [tasks, { isLoading }] = useTasks();

  // Fire time (epoch seconds) we last scheduled per id this session — lets the
  // reconcile detect a time edit on an alarm AlarmKit only reports by id.
  const scheduledEpochs = useRef(new Map<string, number>());

  useEffect(() => {
    if (isLoading) return;

    const sync = async () => {
      const { toSchedule, toCancel } = reconcileAlarms(
        tasks,
        getScheduledAlarmIds(),
        scheduledEpochs.current,
        new Date(),
      );

      await Promise.all([
        ...toCancel.map(async (id) => {
          try {
            await cancelTaskAlarm(id);
            scheduledEpochs.current.delete(id);
          } catch (error) {
            console.warn(`[alarms] Failed to cancel alarm ${id}`, error);
          }
        }),
        ...toSchedule.map(async (alarm) => {
          try {
            await scheduleTaskAlarm(alarm);
            scheduledEpochs.current.set(alarm.id, alarm.epochSeconds);
          } catch (error) {
            console.warn(
              `[alarms] Failed to schedule alarm ${alarm.id}`,
              error,
            );
          }
        }),
      ]);
    };

    void sync();
  }, [tasks, isLoading]);
};
