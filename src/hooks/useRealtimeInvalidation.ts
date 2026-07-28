import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  REALTIME_SUBSCRIBE_STATES,
  RealtimeChannel,
} from "@supabase/supabase-js";

import { goalsQueryOptions } from "./useGoals";
import { HABITS_INVALIDATION_KEYS } from "./useHabits";
import { journalsMutationKey } from "./useJournals";
import { listsQueryOptions } from "./useLists";
import { notesMutationKey } from "./useNotes";
import { TASKS_MUTATION_KEY } from "./useTasks";
import { supabase } from "./useAuth";

// Table -> cache keys to invalidate when a change lands for that table.
// Reuses each hook's own exported key(s) where available (`goalsQueryOptions`/
// `listsQueryOptions`/`HABITS_INVALIDATION_KEYS`) instead of a second
// hand-copied literal that could drift out of sync — the same reason
// `goalsQueryOptions`/`listsQueryOptions` are exported for `(app)/_layout.tsx`'s
// prefetch. The remaining tables have no such export in their hooks (every
// call site there already inlines the literal), so they're listed directly.
// The three searchable tables also invalidate `["search"]` (DEX-47) so an open
// results list doesn't keep showing a note that has since been edited away.
// React Query only refetches *active* queries, so this costs nothing unless the
// Search tab is on screen — and for notes/journals the per-date mutation guard
// below already skips the invalidation while their autosave is in flight.
export const REALTIME_INVALIDATIONS: Record<string, readonly string[][]> = {
  daily_habits: [["dailyHabits"]],
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

// Tables whose cache entries are keyed per date and written by a debounced
// autosave, mapped to the mutation key that autosave tags itself with. Their
// own writes echo back as realtime events, so invalidation has to skip the
// date(s) still saving (see the guard in `invalidateTable`).
const PER_DATE_MUTATION_KEYS: Record<
  string,
  (date: string) => readonly string[]
> = {
  journals: journalsMutationKey,
  notes: notesMutationKey,
};

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
      // Annotated rather than inferred: indexing a `Record<string, …>` yields
      // the value type with no `undefined`, so TypeScript would call the
      // truthiness checks below redundant when in fact most tables have no
      // entry here.
      const perDateMutationKey:
        ((date: string) => readonly string[]) | undefined =
        PER_DATE_MUTATION_KEYS[table];

      if (
        table === "tasks" &&
        queryClient.isMutating({ mutationKey: TASKS_MUTATION_KEY }) > 0
      ) {
        // Our own write echoes back here. The optimistic cache already holds
        // it, and the refetch this would start can resolve *after* a newer
        // local edit — stamping stale rows over it, so the edit visibly
        // reverts. Skipping loses nothing: the in-flight mutation invalidates
        // on settle, which is the catch-up for anything genuinely remote.
        return;
      }

      for (const queryKey of REALTIME_INVALIDATIONS[table]) {
        void queryClient.invalidateQueries({
          queryKey,
          // `notes`/`journals` echo our own autosave back as a realtime event —
          // skip only the date(s) whose autosave is still in flight, so it
          // can't race the debounced editor (see the comment on
          // notesMutationKey), without suppressing invalidation for every other
          // cached date. Every other table invalidates unconditionally.
          //
          // The `queryKey[0] === table` half matters as much as the first: this
          // predicate reads `queryKey[1]` as the date being autosaved, which is
          // only true of the table's own per-date entries (`["notes", date]`).
          // `["search", query]` (DEX-47) carries the search string in that slot,
          // so guarding it too would silently drop a real invalidation whenever
          // someone searched for something date-shaped.
          ...(perDateMutationKey &&
            queryKey[0] === table && {
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
