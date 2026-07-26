import { useEffect, useRef } from "react";
import { Alert } from "react-native";

import {
  alarmSignature,
  alarmSoundFileName,
  cancelTaskAlarm,
  getScheduledAlarmIds,
  reconcileAlarms,
  scheduleTaskAlarm,
} from "@/utils/alarms";

import { useAlarmSoundPreference } from "./usePreferences";
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
  const { alarmSound, isLoading: preferencesLoading } =
    useAlarmSoundPreference();
  const soundName = alarmSoundFileName(alarmSound);

  // What we last scheduled per id this session (see `alarmSignature`) — AlarmKit
  // reports only ids back, so this is how an edit to an existing alarm is seen.
  const scheduled = useRef(new Map<string, string>());

  useEffect(() => {
    // Both queries serve placeholder data first. Acting on the placeholder
    // preferences would schedule every alarm with the default sound and then
    // re-schedule them all once the real row lands (DEX-72).
    if (isLoading || preferencesLoading) return;

    // A sound change re-fires this effect without any task mutation, so two
    // runs can overlap; the superseded one must stop recording what it did, or
    // it would credit the new run's reconcile with the old sound.
    let superseded = false;

    const sync = async () => {
      const { toSchedule, toCancel } = reconcileAlarms(
        tasks,
        getScheduledAlarmIds(),
        scheduled.current,
        new Date(),
        soundName,
      );

      // Tracks whether any alarm this run failed to schedule, so we warn the
      // user once per reconcile rather than firing an Alert per failed alarm.
      let anyScheduleFailed = false;

      await Promise.all([
        ...toCancel.map(async (id) => {
          try {
            await cancelTaskAlarm(id);
            if (!superseded) scheduled.current.delete(id);
          } catch (error) {
            console.warn(`[alarms] Failed to cancel alarm ${id}`, error);
          }
        }),
        ...toSchedule.map(async (alarm) => {
          try {
            await scheduleTaskAlarm(alarm);
            if (!superseded)
              scheduled.current.set(alarm.id, alarmSignature(alarm));
          } catch (error) {
            // Leave it unrecorded so a later reconcile retries. Flag the
            // failure so the user isn't left counting on an alarm that won't
            // ring (e.g. AlarmKit authorization denied — DEX-48).
            anyScheduleFailed = true;
            console.warn(
              `[alarms] Failed to schedule alarm ${alarm.id}`,
              error,
            );
          }
        }),
      ]);

      if (anyScheduleFailed && !superseded) {
        Alert.alert(
          "Alarm not set",
          "We couldn't set one of your task alarms, so it won't ring. Check that alarms are enabled for Dexter in Settings.",
        );
      }
    };

    void sync();
    return () => {
      superseded = true;
    };
  }, [tasks, isLoading, preferencesLoading, soundName]);
};
