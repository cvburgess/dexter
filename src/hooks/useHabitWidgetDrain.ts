import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { upsertDailyHabit } from "@/api/habits";
import {
  clearPendingHabitSteps,
  parsePendingHabitStepsKey,
  readPendingHabitSteps,
} from "@/utils/widgets";

import { supabase, useAuth } from "./useAuth";
import { HABITS_INVALIDATION_KEYS, useHabits } from "./useHabits";

/**
 * Persists the habit steps the widget could not (DEX-160).
 *
 * `DexterHabitStepIntent` runs inside the widget extension, which holds no
 * Supabase session and deliberately never will — see the header of
 * `utils/widgets.shared.ts` for why mirroring one into the App Group would end
 * with the user signed out. So the intent files each tap under
 * `PENDING_HABIT_STEPS_KEY` and the widget renders `pending ?? snapshot`; this
 * hook is the other half, draining the queue into Supabase the next time the
 * app is in front of the user.
 *
 * The direction is why it isn't part of `useWidgetSync`: that hook publishes
 * *to* the App Group and touches no server, this one reads *from* it and is the
 * only widget code that writes to the database.
 *
 * Mounted once, high in the authenticated tree. No-ops off iOS, where
 * `readPendingHabitSteps` is always empty.
 */
export const useHabitWidgetDrain = (): void => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [habits, { isLoading: habitsLoading }] = useHabits();

  const isSignedIn = !!session;

  // Whether a drain is already in flight. Foregrounding fires the listener
  // while the mount pass may still be awaiting Supabase, and two passes over
  // the same queue would both try to persist — and then both clear — the same
  // keys.
  const draining = useRef(false);

  // The habit list as of the last commit, read through a ref so the drain can
  // look up a habit's `steps` without the callback (and with it the effect and
  // its listener) being torn down and rebuilt on every habits refetch.
  const habitsRef = useRef(habits);
  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

  const drain = useCallback(async () => {
    if (draining.current) return;

    const pending = readPendingHabitSteps();
    const entries = Object.entries(pending);
    if (entries.length === 0) return;

    draining.current = true;

    // The keys that reached the database, cleared together at the end. A key
    // whose write threw is left in the queue on purpose: the next foreground
    // retries it, which is the whole point of the queue surviving a failure.
    const drained: string[] = [];
    const dates = new Set<string>();

    try {
      for (const [key, stepsComplete] of entries) {
        const parsed = parsePendingHabitStepsKey(key);

        // Written by the extension, so this parses another binary's output. A
        // key this build cannot read would otherwise sit in the queue forever,
        // retried on every foreground; dropping it costs one tap.
        if (!parsed) {
          drained.push(key);
          continue;
        }

        const habit = habitsRef.current.find(
          (candidate) => candidate.id === parsed.habitId,
        );

        // Archived or deleted since the tap. Same reasoning: nothing will ever
        // make this entry land, so it leaves rather than accumulating.
        if (!habit) {
          drained.push(key);
          continue;
        }

        try {
          await upsertDailyHabit(supabase, {
            date: parsed.date,
            habitId: parsed.habitId,
            steps: habit.steps,
            // The intent computed this against the target the *snapshot*
            // carried, which an edit in the app can have lowered since. The DB
            // trigger already clamps `steps_complete` on a same-day `steps`
            // edit; this keeps a row created by the upsert itself from being
            // the one place that escapes it.
            stepsComplete: Math.min(stepsComplete, habit.steps),
          });
          drained.push(key);
          dates.add(parsed.date);
        } catch {
          // Offline, or a row the server rejected. Left queued for the next
          // foreground — the widget is still showing this value, so the user
          // sees no regression in the meantime.
        }
      }

      clearPendingHabitSteps(drained);

      if (dates.size > 0) {
        // Both keys, not just `dailyHabits`: the Review step's hero counts
        // finished habits and reads through the same pairing
        // `HABITS_INVALIDATION_KEYS` exists to keep in step.
        HABITS_INVALIDATION_KEYS.forEach((queryKey) => {
          void queryClient.invalidateQueries({ queryKey });
        });
      }
    } finally {
      draining.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    // Nothing to drain into without a session, and the sign-out path in
    // `useWidgetSync` has already emptied the queue by this point.
    if (!isSignedIn) return;

    // **Waiting on the habits list is not an optimisation.** The drain reads a
    // habit's `steps` to clamp the queued value, and treats a habit it cannot
    // find as one deleted since the tap — so draining against the empty list a
    // cold start begins with would discard every queued step as belonging to a
    // habit that no longer exists, which is the one failure this queue exists
    // to prevent.
    if (habitsLoading) return;

    // A cold start never fires an `AppState` change, so the queue a killed app
    // accumulated has to be picked up here.
    void drain();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void drain();
    });

    return () => subscription.remove();
  }, [drain, habitsLoading, isSignedIn]);
};
