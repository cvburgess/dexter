import { useEffect, useMemo, useRef } from "react";
import { Alert } from "react-native";

import {
  alarmSignature,
  alarmSoundFileName,
  cancelTaskAlarm,
  getScheduledAlarmIds,
  reconcileAlarms,
  scheduleTaskAlarm,
} from "@/utils/alarms";

import { useTheme } from "@/utils/theme";

import { useLiveFocusBlockId } from "./useFocusBlocks";
import { useAlarmSoundPreference } from "./usePreferences";
import { useTasks } from "./useTasks";

// Reconciles AlarmKit against what tasks say should ring, so complete/delete/
// reschedule/repeat occurrences all self-heal on every launch (DEX-48).
export const useAlarmSync = (): void => {
  const [tasks, { isLoading }] = useTasks();
  const { alarmSound, isLoading: preferencesLoading } =
    useAlarmSoundPreference();
  const soundName = alarmSoundFileName(alarmSound);

  // Baked in at schedule time, deliberately not part of `alarmSignature` — a
  // theme change recolours nothing already scheduled (see `scheduleTaskAlarm`).
  const { colors } = useTheme();

  // The focus block's timer alarm isn't owned by this reconcile (DEX-156) and
  // carries no marker, so it must be named here or the next mutation cancels it.
  const { id: focusBlockId, isLoading: focusBlockLoading } =
    useLiveFocusBlockId();
  const protectedIds = useMemo(
    () => new Set(focusBlockId ? [focusBlockId] : []),
    [focusBlockId],
  );

  // What we last scheduled per id this session (see `alarmSignature`) — AlarmKit
  // reports only ids back, so this is how an edit to an existing alarm is seen.
  const scheduled = useRef(new Map<string, string>());

  // Queued, never overlapped: two in-flight runs would race the same id in
  // AlarmKit and leave a stale sound or title ringing until next launch.
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    // Placeholder preferences would schedule every alarm with the default
    // sound (DEX-72); an unresolved focus block looks identical to "no block".
    if (isLoading || preferencesLoading || focusBlockLoading) return;

    const sync = async () => {
      const { toSchedule, toCancel } = reconcileAlarms(
        tasks,
        getScheduledAlarmIds(),
        scheduled.current,
        new Date(),
        soundName,
        protectedIds,
      );

      // Tracks whether any alarm this run failed to schedule, so we warn the
      // user once per reconcile rather than firing an Alert per failed alarm.
      let anyScheduleFailed = false;

      await Promise.all([
        ...toCancel.map(async (id) => {
          try {
            await cancelTaskAlarm(id);
            scheduled.current.delete(id);
          } catch (error) {
            console.warn(`[alarms] Failed to cancel alarm ${id}`, error);
          }
        }),
        ...toSchedule.map(async (alarm) => {
          try {
            await scheduleTaskAlarm(alarm, {
              tint: colors.primary,
              content: colors.primaryContent,
            });
            scheduled.current.set(alarm.id, alarmSignature(alarm));
          } catch (error) {
            // Leave unrecorded so a later reconcile retries.
            anyScheduleFailed = true;
            console.warn(
              `[alarms] Failed to schedule alarm ${alarm.id}`,
              error,
            );
          }
        }),
      ]);

      if (anyScheduleFailed) {
        Alert.alert(
          "Alarm not set",
          "We couldn't set one of your task alarms, so it won't ring. Check that alarms are enabled for Dexter in Settings.",
        );
      }
    };

    // `catch` so a throw outside the per-alarm handlers (e.g. `getAllAlarms`)
    // can't leave the queue permanently rejected and skip every later run.
    queue.current = queue.current.then(sync).catch((error) => {
      console.warn("[alarms] Alarm sync failed", error);
    });
  }, [
    tasks,
    isLoading,
    preferencesLoading,
    soundName,
    focusBlockLoading,
    protectedIds,
    colors.primary,
    colors.primaryContent,
  ]);
};
