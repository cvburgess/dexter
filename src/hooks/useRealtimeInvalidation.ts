import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  REALTIME_SUBSCRIBE_STATES,
  RealtimeChannel,
} from "@supabase/supabase-js";

import { FOCUS_BLOCKS_INVALIDATION_KEYS } from "./useFocusBlocks";
import { goalsQueryOptions } from "./useGoals";
import { HABITS_INVALIDATION_KEYS } from "./useHabits";
import { journalsMutationKey } from "./useJournals";
import { listsQueryOptions } from "./useLists";
import { notesMutationKey } from "./useNotes";
import { TASKS_MUTATION_KEY } from "./useTasks";
import { supabase } from "./useAuth";

// Table -> cache keys to invalidate. Reuses each hook's exported key so the
// two can't drift; searchable tables also invalidate ["search"] (DEX-47).
export const REALTIME_INVALIDATIONS: Record<string, readonly string[][]> = {
  daily_habits: [["dailyHabits"]],
  focus_blocks: FOCUS_BLOCKS_INVALIDATION_KEYS,
  goals: [goalsQueryOptions.queryKey],
  habits: HABITS_INVALIDATION_KEYS,
  journals: [["journals"], ["search"]],
  lists: [listsQueryOptions.queryKey],
  notes: [["notes"], ["search"]],
  preferences: [["preferences"]],
  repeat_task_templates: [["templates"]],
  tasks: [["tasks"], ["search"]],
};

const REALTIME_TABLES = Object.keys(REALTIME_INVALIDATIONS);

// Query keys keyed per date, mapped to their debounced autosave's mutation key
// so invalidation can skip in-flight dates (own writes echo back as realtime).
const PER_DATE_MUTATION_KEYS: Partial<
  Record<string, (date: string) => readonly string[]>
> = {
  journals: journalsMutationKey,
  notes: notesMutationKey,
};

// Coalesces a burst of events on one table into a single refetch instead of
// one cancel-and-restart per row.
const FLUSH_DEBOUNCE_MS = 250;

/** Subscribes to realtime changes and invalidates matching cache entries —
 * signal only, payloads never cached. A rejoin invalidates everything once. */
export const useRealtimeInvalidation = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const pendingTables = new Set<(typeof REALTIME_TABLES)[number]>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const invalidateTable = (table: (typeof REALTIME_TABLES)[number]) => {
      for (const queryKey of REALTIME_INVALIDATIONS[table]) {
        if (
          queryKey[0] === "tasks" &&
          queryClient.isMutating({ mutationKey: TASKS_MUTATION_KEY }) > 0
        ) {
          // Our own write echoes back here; a refetch could revert a newer
          // local edit. Scoped to ["tasks"] — ["search"] has no optimistic path.
          continue;
        }

        // Looked up per key, not per table — notes invalidates both
        // ["notes", date] and ["search", query], and only the first has a date.
        const perDateMutationKey = PER_DATE_MUTATION_KEYS[queryKey[0]];

        void queryClient.invalidateQueries({
          queryKey,
          // Skip only date(s) mid-autosave, so our own echo can't race the
          // debounced editor; every other cached date still invalidates.
          ...(perDateMutationKey && {
            predicate: (query) =>
              queryClient.isMutating({
                mutationKey: perDateMutationKey(query.queryKey[1] as string),
              }) === 0,
          }),
        });
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
