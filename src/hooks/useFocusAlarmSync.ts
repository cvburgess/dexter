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

  // Baked in at schedule time and deliberately absent from the signature, the
  // same bargain `useAlarmSync` takes — see `scheduleFocusAlarm`.
  const { colors } = useTheme();

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
      // Only ids this hook could own are ever candidates — what it scheduled
      // this session, plus the live block's own id — so a sweep here can never
      // reach a task alarm. The mirror of this is `protectedIds` in
      // `useAlarmSync`.
      //
      // The live block's id has to be in that set, not just the cache: the cache
      // is per-session, and while a block is live `useAlarmSync` protects its id
      // from *its* sweep. A pause whose cancel didn't land before the app closed
      // would otherwise leave an alarm no one will ever cancel, ringing at the
      // original end time while the block sits paused.
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

      // Already scheduled in exactly this shape — nothing to do. The cache is
      // per-session, so a launch always reschedules the running block once; that
      // is `useAlarmSync`'s bargain too, and the only way to be sure, since
      // AlarmKit reports ids and never what they were scheduled with.
      const signature = alarmSignature(desired);
      if (scheduled.current.get(desired.id) === signature) return;

      try {
        await scheduleFocusAlarm(desired, colors.primary);
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
    colors.primary,
  ]);
};
