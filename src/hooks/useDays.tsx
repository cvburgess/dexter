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

  const { data: day = defaultDay, isLoading } = useQuery({
    queryKey: ["days", date],
    queryFn: () => getDay(supabase, date),
    retry: false,
    staleTime: 1000 * 60 * 10,
  });

  const { mutate: upsert } = useMutation<
    TDay,
    Error,
    Omit<TUpsertDay, "date">,
    { previous?: TDay }
  >({
    mutationFn: (diff) => upsertDay(supabase, { ...diff, date }),
    // Optimistically fold the diff into the cache so autosave feels instant and
    // switching views (Notes ↔ Tasks) doesn't flash stale content before the
    // round-trip settles; roll back on error. Mirrors usePreferences.
    onMutate: async (diff) => {
      await queryClient.cancelQueries({ queryKey: ["days", date] });
      const previous = queryClient.getQueryData<TDay>(["days", date]);
      queryClient.setQueryData<TDay>(["days", date], {
        ...(previous ?? defaultDay),
        ...diff,
      });
      return { previous };
    },
    onError: (_error, _diff, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["days", date], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["days", date] });
    },
  });

  return [day, { isLoading, upsertDay: upsert }];
};
