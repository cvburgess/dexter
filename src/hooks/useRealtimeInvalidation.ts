import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  REALTIME_SUBSCRIBE_STATES,
  RealtimeChannel,
} from "@supabase/supabase-js";

import { daysMutationKey } from "./useDays";
import { goalsQueryOptions } from "./useGoals";
import { listsQueryOptions } from "./useLists";
import { supabase } from "./useAuth";

// Table -> cache keys to invalidate when a change lands for that table. A
// habit edit can also delete/reshape today's daily rows (pause/archive, a
// days_active change), so `habits` invalidates `dailyHabits` too — mirrors
// `invalidateHabits` in useHabits.tsx. `lists`/`goals` reuse their hooks'
// exported `queryOptions` key instead of a second hand-copied literal, the
// same reason those are exported for `(app)/_layout.tsx`'s prefetch.
export const REALTIME_INVALIDATIONS: Record<string, readonly string[][]> = {
  daily_habits: [["dailyHabits"]],
  days: [["days"]],
  goals: [goalsQueryOptions.queryKey],
  habits: [["habits"], ["dailyHabits"]],
  lists: [listsQueryOptions.queryKey],
  preferences: [["preferences"]],
  repeat_task_templates: [["templates"]],
  tasks: [["tasks"]],
};

const REALTIME_TABLES = Object.keys(REALTIME_INVALIDATIONS);

// How long to wait for more events on the same table before invalidating —
// coalesces a burst (e.g. a bulk task update) into a single refetch instead
// of one cancel-and-restart per row.
const FLUSH_DEBOUNCE_MS = 250;

/**
 * Subscribes to Postgres changes on every realtime-enabled table for the
 * signed-in user and invalidates the matching query cache entries. This is
 * an invalidation *signal* only — event payloads are never written into the
 * cache, so a refetch always goes through the normal RLS-scoped REST path.
 * That sidesteps two Realtime limitations (DELETE events aren't filterable,
 * and their `old` record is PK-only under RLS): worst case an event is
 * missed or delayed, and the existing staleTime/focus-refetch layer catches
 * up within `DEFAULT_STALE_TIME_MS` (see QueryProvider).
 *
 * Realtime does not replay events missed while disconnected (e.g. the app
 * was backgrounded), so a rejoin after the first `SUBSCRIBED` invalidates
 * every mapped key once as a catch-up.
 */
export const useRealtimeInvalidation = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const pendingTables = new Set<(typeof REALTIME_TABLES)[number]>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const invalidateTable = (table: (typeof REALTIME_TABLES)[number]) => {
      for (const queryKey of REALTIME_INVALIDATIONS[table]) {
        if (table === "days") {
          // `days` echoes our own autosave back as a realtime event — skip
          // only the date(s) whose autosave is still in flight, so it can't
          // race the debounced editor (see the comment on daysMutationKey),
          // without suppressing invalidation for every other cached date.
          void queryClient.invalidateQueries({
            queryKey,
            predicate: (query) =>
              queryClient.isMutating({
                mutationKey: daysMutationKey(query.queryKey[1] as string),
              }) === 0,
          });
          continue;
        }
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    const scheduleFlush = (table: (typeof REALTIME_TABLES)[number]) => {
      pendingTables.add(table);
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        const tables = [...pendingTables];
        pendingTables.clear();
        tables.forEach(invalidateTable);
      }, FLUSH_DEBOUNCE_MS);
    };

    const channel: RealtimeChannel = supabase.channel(
      `invalidations:${userId}`,
    );

    for (const table of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        () => scheduleFlush(table),
      );
    }

    let hasSubscribed = false;
    channel.subscribe((status: `${REALTIME_SUBSCRIBE_STATES}`) => {
      if (status !== "SUBSCRIBED") return;
      if (hasSubscribed) {
        // A rejoin after a drop — missed events aren't replayed, so
        // invalidate everything once to catch up.
        REALTIME_TABLES.forEach(invalidateTable);
      }
      hasSubscribed = true;
    });

    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
};
