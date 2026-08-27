import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { searchEntries, TSearchResult } from "@/api/search";

import { supabase } from "./useAuth";

// Below this, a one-letter query matches so much of the corpus that results
// are noise, and every keystroke would fire a round trip regardless.
export const MIN_SEARCH_LENGTH = 2;

const EMPTY_RESULTS: TSearchResult[] = [];

type TUseSearch = [
  TSearchResult[],
  {
    isLoading: boolean;
    /** Whether `query` is long enough to have been searched at all. */
    enabled: boolean;
    /** The query the results actually match, lagging `query` mid-flight —
     * highlight with this or excerpts lose their mark until new results land. */
    matchedQuery: string;
  },
];

// Searches via the server search_entries RPC (DEX-47) — unlike useTasks's
// cached 30-day array, which would silently miss older completed tasks.
export const useSearch = (query: string): TUseSearch => {
  const trimmed = query.trim();
  const enabled = trimmed.length >= MIN_SEARCH_LENGTH;

  const { data, isLoading } = useQuery({
    // Keyed on the trimmed query, so "  todo" and "todo" share one cache entry
    // — and so does re-typing a query the user already ran.
    queryKey: ["search", trimmed],
    // The query travels with its results rather than a ref: while
    // keepPreviousData holds prior rows, data.query is what they matched.
    queryFn: async () => ({
      query: trimmed,
      results: await searchEntries(supabase, trimmed),
    }),
    enabled,
    // Without this every keystroke makes `data` undefined for a beat, tearing
    // down the FlashList and rebuilding every row per character typed.
    placeholderData: keepPreviousData,
  });

  return [
    data?.results ?? EMPTY_RESULTS,
    { isLoading, enabled, matchedQuery: data?.query ?? trimmed },
  ];
};
