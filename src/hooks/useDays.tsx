import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  getDay,
  TDay,
  TJournalPrompt,
  TUpsertDay,
  upsertDay,
} from "@/api/days";

import { supabase } from "./useAuth";
import { usePreferences } from "./usePreferences";

type TUseDays = [
  TDay & { prompts: TJournalPrompt[] },
  {
    isLoading: boolean;
    /** Whether a `days` row exists for this date (vs. the default fallback). */
    exists: boolean;
    upsertDay: (diff: Omit<TUpsertDay, "date">) => void;
  },
];

export const useDays = (date: string): TUseDays => {
  const queryClient = useQueryClient();
  const [preferences] = usePreferences();

  const defaultDay: TDay = useMemo(
    () => ({
      date,
      // A day with no row reads as a blank note (empty string). The daily-note
      // template is NOT auto-applied here: notes UI offers "Use template" /
      // "Blank note" when opening a blank day, so pre-filling would defeat that
      // choice. Journal prompts still seed from the template (DEX-37).
      notes: "",
      prompts: preferences.templatePrompts.map((prompt) => ({
        prompt,
        response: "",
      })),
    }),
    [date, preferences.templatePrompts],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["days", date],
    queryFn: () => getDay(supabase, date),
    retry: false,
    staleTime: 1000 * 60 * 10,
  });

  // `data` is a row (TDay), `null` when the day has no row yet, or `undefined`
  // while loading. Fall back to the blank default in the latter two cases, but
  // surface whether a real row exists so callers can distinguish "never
  // started" from "started but blank".
  const day = data ?? defaultDay;
  const exists = data != null;

  const { mutate: upsert } = useMutation<
    TDay,
    Error,
    Omit<TUpsertDay, "date">,
    { previous: TDay | null | undefined }
  >({
    mutationFn: (diff) => upsertDay(supabase, { ...diff, date }),
    // Optimistically fold the diff into the cache so autosave feels instant and
    // switching views (Notes ↔ Tasks) doesn't flash stale content before the
    // round-trip settles; roll back on error. Mirrors usePreferences.
    onMutate: async (diff) => {
      await queryClient.cancelQueries({ queryKey: ["days", date] });
      const previous = queryClient.getQueryData<TDay | null>(["days", date]);
      queryClient.setQueryData<TDay>(["days", date], {
        ...(previous ?? defaultDay),
        ...diff,
      });
      return { previous };
    },
    onError: (_error, _diff, context) => {
      if (context && context.previous !== undefined) {
        // Restore the prior cache value — a row, or `null` for a known no-row
        // day (both are concrete values React Query will set).
        queryClient.setQueryData(["days", date], context.previous);
      } else {
        // The day was never fetched (e.g. still errored), so there's nothing to
        // restore to — drop the optimistic entry so a never-persisted note
        // doesn't linger. (`setQueryData(…, undefined)` is a no-op.)
        queryClient.removeQueries({ queryKey: ["days", date] });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["days", date] });
    },
  });

  return [day, { isLoading, exists, upsertDay: upsert }];
};
