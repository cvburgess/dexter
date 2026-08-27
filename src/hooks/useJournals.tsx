import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  getJournal,
  TJournal,
  TUpsertJournal,
  upsertJournal,
} from "@/api/journals";

import { supabase } from "./useAuth";
import { usePreferences } from "./usePreferences";

type TUseJournals = [
  TJournal,
  {
    isLoading: boolean;
    /** Whether a `journals` row exists for this date (vs. the default fallback). */
    exists: boolean;
    upsertJournal: (diff: Omit<TUpsertJournal, "date">) => void;
    /** Awaitable upsert so callers can retry a failed save instead of dropping it. */
    upsertJournalAsync: (
      diff: Omit<TUpsertJournal, "date">,
    ) => Promise<TJournal>;
  },
];

// useRealtimeInvalidation checks this via isMutating to skip refetching a
// date whose autosave is still in flight (own upsert echoes back as realtime).
export const journalsMutationKey = (date: string) => ["journals", date];

export const useJournals = (date: string): TUseJournals => {
  const queryClient = useQueryClient();
  const [{ templatePrompts }] = usePreferences();

  const defaultJournal: TJournal = useMemo(
    () => ({
      date,
      // Auto-seeds so a blank day is answerable; nothing persists until the user
      // types (DEX-37). Every ritual's prompts, or a save drops the other's half.
      prompts: templatePrompts.map(({ prompt, period }) => ({
        prompt,
        period,
        response: "",
      })),
      mood: null,
    }),
    // Just the prompts — the whole row would rebuild this on an unrelated edit.
    [date, templatePrompts],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["journals", date],
    queryFn: () => getJournal(supabase, date),
    retry: false,
  });

  // `data` is a row, `null` (no row), or `undefined` (loading); fall back to
  // the seeded default but surface `exists` for "never started" vs "blank".
  const journal = data ?? defaultJournal;
  const exists = data != null;

  // A mood-only write on a day with no row would insert `prompts` at its column
  // default of `[]`, stranding the day on the template it never got seeded with.
  const withSeed = (diff: Omit<TUpsertJournal, "date">) =>
    exists || diff.prompts
      ? diff
      : { ...diff, prompts: defaultJournal.prompts };

  const { mutate: upsert, mutateAsync: upsertAsync } = useMutation<
    TJournal,
    Error,
    Omit<TUpsertJournal, "date">,
    { previous: TJournal | null | undefined }
  >({
    mutationFn: (diff) => upsertJournal(supabase, { ...withSeed(diff), date }),
    mutationKey: journalsMutationKey(date),
    // Retry at the QueryClient level (upsert is idempotent) so a failed save
    // survives the component unmounting, e.g. on a date change or tab switch.
    retry: 3,
    // Optimistic so autosave feels instant and switching views doesn't flash
    // stale content; roll back on error. Mirrors usePreferences.
    onMutate: async (diff) => {
      await queryClient.cancelQueries({ queryKey: ["journals", date] });
      const previous = queryClient.getQueryData<TJournal | null>([
        "journals",
        date,
      ]);
      queryClient.setQueryData<TJournal>(["journals", date], {
        ...(previous ?? defaultJournal),
        ...diff,
      });
      return { previous };
    },
    onError: (_error, _diff, context) => {
      if (context && context.previous !== undefined) {
        // A row, or `null` for a known no-row day — both are concrete values.
        queryClient.setQueryData(["journals", date], context.previous);
      } else {
        // Never fetched, so nothing to restore to — drop the optimistic entry.
        queryClient.removeQueries({ queryKey: ["journals", date] });
      }
    },
    // Write straight into the cache rather than invalidate: a refetch could
    // race an in-flight edit and stamp a stale value over newer text.
    onSuccess: (saved) => {
      queryClient.setQueryData(["journals", date], saved);
    },
  });

  return [
    journal,
    {
      isLoading,
      exists,
      upsertJournal: upsert,
      upsertJournalAsync: upsertAsync,
    },
  ];
};
