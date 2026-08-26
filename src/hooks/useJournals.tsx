import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  getJournal,
  TJournal,
  TUpsertJournal,
  upsertJournal,
} from "@/api/journals";
import { mergeTemplatePrompts } from "@/utils/journalPrompts";

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

// The realtime invalidation layer (useRealtimeInvalidation) checks this key
// via `queryClient.isMutating` to skip refetching a date's cache entry while
// its autosave is in flight — our own upsert echoes back as a realtime
// event, and a refetch here would race the debounced editor (see the
// onSuccess comment below). Scoped per date (not just "journals") so an
// autosave still retrying for one date (e.g. after a swipe away — see the
// `retry` comment below) doesn't suppress a genuine incoming update for a
// different, unrelated date.
export const journalsMutationKey = (date: string) => ["journals", date];

export const useJournals = (date: string): TUseJournals => {
  const queryClient = useQueryClient();
  const [{ templatePrompts, templatePromptsPm }] = usePreferences();

  const defaultJournal: TJournal = useMemo(
    () => ({
      date,
      // Unlike notes (which offer a template chooser), prompts auto-seed from
      // the template so a blank day is immediately answerable. Nothing persists
      // until the user types a response (DEX-37).
      //
      // Seeds **both** rituals' prompts, morning first, each stamped with its
      // period (DEX-151) — the day holds every question it will be asked, and
      // `JournalView` renders the subset belonging to the ritual on screen.
      // Seeding only the current mode's would mean the evening's first save
      // wrote a row the morning was missing from, and the day's other half
      // would be gone for good.
      prompts: mergeTemplatePrompts({
        templatePrompts,
        templatePromptsPm,
      }).map(({ prompt, period }) => ({ prompt, period, response: "" })),
    }),
    // The two arrays, not `preferences` — the seed depends on nothing else, and
    // depending on the whole row would rebuild it on an unrelated edit.
    [date, templatePrompts, templatePromptsPm],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["journals", date],
    queryFn: () => getJournal(supabase, date),
    retry: false,
  });

  // `data` is a row (TJournal), `null` when the day has no row yet, or
  // `undefined` while loading. Fall back to the template-seeded default in the
  // latter two cases, but surface whether a real row exists so callers can
  // distinguish "never started" from "started but blank".
  const journal = data ?? defaultJournal;
  const exists = data != null;

  const { mutate: upsert, mutateAsync: upsertAsync } = useMutation<
    TJournal,
    Error,
    Omit<TUpsertJournal, "date">,
    { previous: TJournal | null | undefined }
  >({
    mutationFn: (diff) => upsertJournal(supabase, { ...diff, date }),
    mutationKey: journalsMutationKey(date),
    // Retry a failed save at the QueryClient level (upsert is idempotent). This
    // survives the component unmounting — an unmount flush (date change / tab
    // switch) that fails would otherwise have no mounted component left to
    // reschedule it, silently dropping the edit. `onError`/rollback runs only
    // after retries are exhausted.
    retry: 3,
    // Optimistically fold the diff into the cache so autosave feels instant and
    // switching views (Journal ↔ Tasks) doesn't flash stale content before the
    // round-trip settles; roll back on error. Mirrors usePreferences.
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
        // Restore the prior cache value — a row, or `null` for a known no-row
        // day (both are concrete values React Query will set).
        queryClient.setQueryData(["journals", date], context.previous);
      } else {
        // The day was never fetched (e.g. still errored), so there's nothing to
        // restore to — drop the optimistic entry so a never-persisted response
        // doesn't linger. (`setQueryData(…, undefined)` is a no-op.)
        queryClient.removeQueries({ queryKey: ["journals", date] });
      }
    },
    // Write the persisted row straight into the cache rather than invalidating
    // (refetching): a refetch races with in-flight/optimistic edits and can
    // stamp a stale server value over newer text, which the uncontrolled inputs
    // then re-seed from on remount. The mutation response IS the latest saved
    // state, so no GET is needed.
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
