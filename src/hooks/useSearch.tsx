import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { searchEntries, TSearchResult } from "@/api/search";

import { supabase } from "./useAuth";

/**
 * Below this, a query matches so much of the corpus that the results are noise
 * rather than an answer — and every keystroke of a one-letter query would fire a
 * round trip. The screen shows its prompt state instead.
 */
export const MIN_SEARCH_LENGTH = 2;

const EMPTY_RESULTS: TSearchResult[] = [];

type TUseSearch = [
  TSearchResult[],
  {
    isLoading: boolean;
    /** Whether `query` is long enough to have been searched at all. */
    enabled: boolean;
    /**
     * The query the returned results actually correspond to, which lags `query`
     * while a newer search is in flight (see `placeholderData` below). Highlight
     * with this rather than the live query, or every excerpt on screen loses its
     * highlight and jumps to the head of its note until the new results land.
     */
    matchedQuery: string;
  },
];

/**
 * Searches tasks, notes, and journal entries for `query` (DEX-47).
 *
 * Unlike `useTasks`, this does **not** derive from a cached client-side array:
 * `useTasks`' canonical fetch holds incomplete tasks plus the last 30 days only
 * (`RECENT_TASK_WINDOW_DAYS`), so searching it would silently miss anything
 * older that had been completed. Notes and journals aren't fetched in bulk at
 * all — both hooks are keyed per date. So this goes to the server, where the
 * `search_entries` RPC is also what the MCP server calls.
 *
 * Debouncing belongs to the caller, which owns the text input; this hook keys
 * off whatever query it is handed.
 */
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
