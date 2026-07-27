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

// The realtime invalidation layer (useRealtimeInvalidation) checks this key
// via `queryClient.isMutating` to skip refetching a date's cache entry while
// its autosave is in flight — our own upsert echoes back as a realtime
// event, and a refetch here would race the debounced editor (see the
// onSuccess comment below). Scoped per date (not just "notes") so an autosave
// still retrying for one date (e.g. after a swipe away — see the `retry`
// comment below) doesn't suppress a genuine incoming update for a different,
// unrelated date.
export const notesMutationKey = (date: string) => ["notes", date];

export const useNotes = (date: string): TUseNotes => {
  const queryClient = useQueryClient();

  const defaultNote: TNote = useMemo(
    () => ({
      date,
      // A day with no row reads as a blank note (empty string). The daily-note
      // template is NOT auto-applied here: notes UI offers "Use template" /
      // "Blank note" when opening a blank day, so pre-filling would defeat that
      // choice.
      content: "",
    }),
    [date],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["notes", date],
    queryFn: () => getNote(supabase, date),
    retry: false,
  });

  // `data` is a row (TNote), `null` when the day has no row yet, or `undefined`
  // while loading. Fall back to the blank default in the latter two cases, but
  // surface whether a real row exists so callers can distinguish "never
  // started" from "started but blank".
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
    // Retry a failed save at the QueryClient level (upsert is idempotent). This
    // survives the component unmounting — an unmount flush (date change / tab
    // switch) that fails would otherwise have no mounted component left to
    // reschedule it, silently dropping the edit. `onError`/rollback runs only
    // after retries are exhausted.
    retry: 3,
    // Optimistically fold the diff into the cache so autosave feels instant and
    // switching views (Notes ↔ Tasks) doesn't flash stale content before the
    // round-trip settles; roll back on error. Mirrors usePreferences.
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
        // The day was never fetched (e.g. still errored), so there's nothing to
        // restore to — drop the optimistic entry so a never-persisted note
        // doesn't linger. (`setQueryData(…, undefined)` is a no-op.)
        queryClient.removeQueries({ queryKey: ["notes", date] });
      }
    },
    // Write the persisted row straight into the cache rather than invalidating
    // (refetching): a refetch races with in-flight/optimistic edits and can
    // stamp a stale server value over newer text, which the uncontrolled editor
    // then re-seeds from on remount. The mutation response IS the latest saved
    // state, so no GET is needed.
    onSuccess: (saved) => {
      queryClient.setQueryData(["notes", date], saved);
    },
  });

  return [
    note,
    { isLoading, exists, upsertNote: upsert, upsertNoteAsync: upsertAsync },
  ];
};
