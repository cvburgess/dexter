import { useEffect, useRef } from "react";
import { Alert } from "react-native";

import { TFocusBlock } from "@/api/focusBlocks";
import {
  alarmSignature,
  alarmSoundFileName,
  cancelTaskAlarm,
  focusAlarmFor,
  getScheduledAlarmIds,
  scheduleFocusAlarm,
} from "@/utils/alarms";
import { useTheme } from "@/utils/theme";

import { useAlarmSoundPreference } from "./usePreferences";

/**
 * One-way sync of the live block's AlarmKit countdown (DEX-156); the lock
 * screen is read-only by design (see `scheduleFocusAlarm`). Call once.
 */
export const useFocusAlarmSync = (block: TFocusBlock | null): void => {
  const { alarmSound, isLoading: preferencesLoading } =
    useAlarmSoundPreference();
  const soundName = alarmSoundFileName(alarmSound);

  // Baked in at schedule time and deliberately absent from the signature, the
  // same bargain `useAlarmSync` takes — see `scheduleFocusAlarm`.
  const { colors } = useTheme();

  // AlarmKit reports only ids back, so this is how a still-correct alarm is
  // told apart from one needing replacement. At most one live block, one entry.
  const scheduled = useRef(new Map<string, string>());

  // Queued, never overlapped (see `useAlarmSync`): overlapping runs reconcile
  // against a cache the other hasn't written yet.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const id = block?.id;
  const status = block?.status;
  const resumedAt = block?.resumedAt;
  const remainingSeconds = block?.remainingSeconds;
  const title = block?.tasks.title;

  useEffect(() => {
    // Acting on the placeholder preferences row would schedule with the default
    // sound, then re-schedule when the real row lands (DEX-72).
    if (preferencesLoading) return;

    const sync = async () => {
      const desired =
        id && status && title
          ? focusAlarmFor(
              {
                id,
                title,
                status,
                remainingSeconds: remainingSeconds ?? 0,
                resumedAt: resumedAt ?? null,
              },
              new Date(),
              soundName,
            )
          : null;

      // Only ids this hook could own are sweep candidates, so it never
      // reaches a task alarm; the live id joins the per-session cache.
      const owned = new Set(scheduled.current.keys());
      if (id && getScheduledAlarmIds().includes(id)) owned.add(id);

      const toCancel = [...owned].filter((ownedId) => ownedId !== desired?.id);

      for (const staleId of toCancel) {
        try {
          await cancelTaskAlarm(staleId);
          scheduled.current.delete(staleId);
        } catch (error) {
          console.warn(
            `[alarms] Failed to cancel focus alarm ${staleId}`,
            error,
          );
        }
      }

      if (!desired) return;

      // The cache is per-session, so a launch reschedules the running block
      // once — AlarmKit reports ids, never what they were scheduled with.
      const signature = alarmSignature(desired);
      if (scheduled.current.get(desired.id) === signature) return;

      try {
        await scheduleFocusAlarm(desired, {
          tint: colors.primary,
          content: colors.primaryContent,
        });
        scheduled.current.set(desired.id, signature);
      } catch (error) {
        // Left unrecorded so the next run retries. A block the user believes
        // will ring and won't is worth interrupting for.
        console.warn(
          `[alarms] Failed to schedule focus alarm ${desired.id}`,
          error,
        );
        Alert.alert(
          "Timer won't ring",
          "We couldn't set the alarm for this focus block, so it won't ring if you leave the app. Check that alarms are enabled for Dexter in Settings.",
        );
      }
    };

    // `catch` so a throw outside the handlers above can't leave the queue
    // permanently rejected and skip every later run.
    queue.current = queue.current.then(sync).catch((error) => {
      console.warn("[alarms] Focus alarm sync failed", error);
    });
  }, [
    id,
    status,
    resumedAt,
    remainingSeconds,
    title,
    soundName,
    preferencesLoading,
    colors.primary,
    colors.primaryContent,
  ]);
};
