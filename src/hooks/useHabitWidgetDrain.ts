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
import { useHabits } from "./useHabits";

/**
 * Drains widget-queued habit steps into Supabase on foreground (DEX-160): the
 * extension holds no session (see utils/widgets.shared.ts header). Mount once.
 */
export const useHabitWidgetDrain = (): void => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [habits, { isLoading: habitsLoading }] = useHabits();

  const isSignedIn = !!session;

  // Foregrounding can fire while the mount pass still awaits Supabase; two
  // passes would both persist — then both clear — the same keys.
  const draining = useRef(false);

  // Read through a ref so a habits refetch doesn't tear down and rebuild the
  // callback, the effect, and its AppState listener.
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

    // Keys whose write threw stay queued on purpose — the next foreground
    // retries them; that is the point of the queue surviving a failure.
    const drained: string[] = [];
    const dates = new Set<string>();

    try {
      for (const [key, stepsComplete] of entries) {
        const parsed = parsePendingHabitStepsKey(key);

        // Keys come from another binary; one this build cannot parse would sit
        // queued forever. Dropping it costs one tap.
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
            // The intent computed against the snapshot's target, which an app
            // edit can have lowered since; clamp like the DB trigger does.
            stepsComplete: Math.min(stepsComplete, habit.steps),
          });
          drained.push(key);
          dates.add(parsed.date);
        } catch {
          // Offline or rejected: left queued for the next foreground. The
          // widget still shows this value, so the user sees no regression.
        }
      }

      clearPendingHabitSteps(drained);

      // Not `HABITS_INVALIDATION_KEYS`: a step changes nothing about the habit
      // itself, and refetching the list re-renders the authenticated root.
      if (dates.size > 0) {
        void queryClient.invalidateQueries({ queryKey: ["dailyHabits"] });
      }
    } finally {
      draining.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    // Nothing to drain into without a session, and the sign-out path in
    // `useWidgetSync` has already emptied the queue by this point.
    if (!isSignedIn) return;

    // Not an optimisation: draining against a cold start's empty habits list
    // would discard every queued step as belonging to a deleted habit.
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
