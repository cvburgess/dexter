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

import { useAlarmSoundPreference } from "./usePreferences";

/**
 * Keeps the running focus block's native AlarmKit countdown in sync with the
 * row (DEX-156). The same projection-of-DB-state shape as `useAlarmSync`, and
 * for the same reason: a block ends, is paused, or is stopped through five
 * different transitions across three surfaces, and scheduling imperatively at
 * each of them is five places to forget.
 *
 * **The lock screen is read-only.** The countdown AlarmKit presents carries no
 * pause or resume button — see `scheduleFocusAlarm` for why that is the only
 * correct configuration, and `docs/features.md` → Focus blocks for the rule it
 * settles. So this is a one-way sync by design: nothing on the lock screen can
 * change a block, and the app remains the only writer of the anchor.
 *
 * Called once, by `usePublishFocusTimer` — the hook that already owns every
 * focus-block write and is mounted exactly once by `FocusTimerHost`. No-ops off
 * iOS via `utils/alarms`.
 */
export const useFocusAlarmSync = (block: TFocusBlock | null): void => {
  const { alarmSound, isLoading: preferencesLoading } =
    useAlarmSoundPreference();
  const soundName = alarmSoundFileName(alarmSound);

  // What we last scheduled, by id — AlarmKit reports only ids back, so this is
  // how a still-correct alarm is told apart from one that needs replacing. At
  // most one entry: there is at most one live block.
  const scheduled = useRef(new Map<string, string>());

  // Queued, never overlapped, for the reason spelled out in `useAlarmSync`: two
  // in-flight runs each reconcile against a cache the other hasn't written yet,
  // and whichever native call lands last need not be the one the cache records.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const id = block?.id;
  const status = block?.status;
  const resumedAt = block?.resumedAt;
  const remainingSeconds = block?.remainingSeconds;
  const title = block?.tasks.title;

  useEffect(() => {
    // Acting on the placeholder preferences row would schedule the block with
    // the default sound and re-schedule it the moment the real row lands
    // (DEX-72).
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

      // Everything AlarmKit holds *for a focus block* that shouldn't be there.
      // Task alarms are filtered out by the cache: only ids this hook scheduled
      // are ever candidates, so a reconcile here can never touch DEX-48's work.
      // The mirror of this is `protectedIds` in `useAlarmSync`.
      const toCancel = [...scheduled.current.keys()].filter(
        (scheduledId) => scheduledId !== desired?.id,
      );

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

      // Re-check against what AlarmKit actually holds, not just the cache: on a
      // fresh launch the cache is empty but the alarm may well have survived
      // from the last session, and rescheduling it would be a visible flicker
      // on the lock screen for no change.
      const signature = alarmSignature(desired);
      if (
        scheduled.current.get(desired.id) === signature &&
        getScheduledAlarmIds().includes(desired.id)
      ) {
        return;
      }

      try {
        await scheduleFocusAlarm(desired);
        scheduled.current.set(desired.id, signature);
      } catch (error) {
        // Left unrecorded so the next run retries. The alert matches
        // `useAlarmSync`'s: a block the user believes will ring and won't is
        // worth interrupting for, since the whole point is to stop watching it.
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
  ]);
};
