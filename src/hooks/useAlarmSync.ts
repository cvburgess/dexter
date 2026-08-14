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

  // Baked into each alarm as it is scheduled, and deliberately *not* part of
  // `alarmSignature` — see `scheduleTaskAlarm`. A theme change re-runs this
  // effect and finds every signature unchanged, so it recolours nothing already
  // scheduled and costs no native calls.
  const { colors } = useTheme();

  // The running focus block's timer is an alarm this reconcile does not own
  // (DEX-156), and ids carry no marker of which kind they are — so it has to be
  // named here or the next task mutation cancels it.
  const { id: focusBlockId, isLoading: focusBlockLoading } =
    useLiveFocusBlockId();
  const protectedIds = useMemo(
    () => new Set(focusBlockId ? [focusBlockId] : []),
    [focusBlockId],
  );

  // What we last scheduled per id this session (see `alarmSignature`) — AlarmKit
  // reports only ids back, so this is how an edit to an existing alarm is seen.
  const scheduled = useRef(new Map<string, string>());

  // Runs are queued, never overlapped. A sound change re-fires this effect with
  // no task mutation of its own, and each run reconciles against `scheduled` —
  // so two in-flight runs would each see a cache the other hasn't written yet,
  // re-scheduling alarms that are already correct and racing on the same id
  // (whichever native call lands last wins in AlarmKit, which need not be the
  // one the cache ends up recording — leaving a stale sound or title ringing
  // until the next launch). Serializing makes each reconcile see the finished
  // state of the one before it.
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    // Every query serves placeholder or empty data first. Acting on the
    // placeholder preferences would schedule every alarm with the default sound
    // and then re-schedule them all once the real row lands (DEX-72); acting
    // before the focus block resolves would cancel a running block's timer that
    // survived from the last session, since an unloaded query and "no block"
    // look identical here.
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
            await scheduleTaskAlarm(alarm, colors.primary);
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
  ]);
};
