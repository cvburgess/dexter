import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { getNote, TNote, TUpsertNote, upsertNote } from "@/api/notes";

import { supabase } from "./useAuth";

type TUseNotes = [
  TNote,
  {
    isLoading: boolean;
    /** Whether a `notes` row exists for this date (vs. the default fallback). */
    exists: boolean;
    upsertNote: (diff: Omit<TUpsertNote, "date">) => void;
    /** Awaitable upsert so callers can retry a failed save instead of dropping it. */
    upsertNoteAsync: (diff: Omit<TUpsertNote, "date">) => Promise<TNote>;
  },
];

// useRealtimeInvalidation checks this key to skip refetching while an autosave
// is in flight. Per date, so one date's retry can't suppress another's update.
export const notesMutationKey = (date: string) => ["notes", date];

export const useNotes = (date: string): TUseNotes => {
  const queryClient = useQueryClient();

  const defaultNote: TNote = useMemo(
    () => ({
      date,
      // A no-row day reads as a blank note. The daily-note template is NOT
      // auto-applied — the UI's "Use template" / "Blank note" choice is why.
      content: "",
    }),
    [date],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["notes", date],
    queryFn: () => getNote(supabase, date),
    retry: false,
  });

  // `data`: row, `null` (no row yet), or `undefined` (loading). `exists` lets
  // callers tell "never started" from "started but blank".
  const note = data ?? defaultNote;
  const exists = data != null;

  const { mutate: upsert, mutateAsync: upsertAsync } = useMutation<
    TNote,
    Error,
    Omit<TUpsertNote, "date">,
    { previous: TNote | null | undefined }
  >({
    mutationFn: (diff) => upsertNote(supabase, { ...diff, date }),
    mutationKey: notesMutationKey(date),
    // Retries survive unmount (idempotent upsert): a failed unmount flush has
    // no mounted component left to reschedule it. Rollback runs after retries.
    retry: 3,
    // Optimistic fold-in so autosave feels instant and view switches don't
    // flash stale content; rolls back on error. Mirrors usePreferences.
    onMutate: async (diff) => {
      await queryClient.cancelQueries({ queryKey: ["notes", date] });
      const previous = queryClient.getQueryData<TNote | null>(["notes", date]);
      queryClient.setQueryData<TNote>(["notes", date], {
        ...(previous ?? defaultNote),
        ...diff,
      });
      return { previous };
    },
    onError: (_error, _diff, context) => {
      if (context && context.previous !== undefined) {
        // Restore the prior cache value — a row, or `null` for a known no-row
        // day (both are concrete values React Query will set).
        queryClient.setQueryData(["notes", date], context.previous);
      } else {
        // Never fetched: nothing to restore, so drop the optimistic entry —
        // `setQueryData(…, undefined)` would be a no-op.
        queryClient.removeQueries({ queryKey: ["notes", date] });
      }
    },
    // Write the response into the cache rather than invalidating: a refetch
    // races optimistic edits and can stamp stale text over newer content.
    onSuccess: (saved) => {
      queryClient.setQueryData(["notes", date], saved);
    },
  });

  return [
    note,
    { isLoading, exists, upsertNote: upsert, upsertNoteAsync: upsertAsync },
  ];
};
