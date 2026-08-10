import { useQuery } from "@tanstack/react-query";

import { getHoroscope, THoroscope, TSunSign } from "@/api/horoscopes";

import { supabase } from "./useAuth";

type TUseHoroscope = [
  /** The day's prediction, or `null` when the generator hasn't covered it. */
  THoroscope | null,
  { isLoading: boolean },
];

/**
 * One day's horoscope for one sign (DEX-128).
 *
 * Keyed by both, because the rows are global: two users on the same sign share
 * a cache entry, and the Ritual tab's `DayNav` can walk to any date.
 *
 * **Deliberately not wired to `useRealtimeInvalidation`.** `horoscopes` is not
 * in the `supabase_realtime` publication (see
 * `20260804005118_add_horoscopes.sql`) — the rows change once a day at a fixed
 * hour, so a subscription would idle for 24 hours to deliver what the shared
 * 60s `staleTime` plus a focus refetch already gets.
 */
export const useHoroscope = (
  sunSign: TSunSign | null,
  date: string,
): TUseHoroscope => {
  const { data, isLoading } = useQuery({
    queryKey: ["horoscopes", sunSign, date],
    // The `enabled` gate below means this only runs with a sign, but the
    // closure still has to satisfy the type.
    queryFn: () => (sunSign ? getHoroscope(supabase, sunSign, date) : null),
    enabled: !!sunSign,
  });

  return [
    data ?? null,
    {
      // A disabled query never leaves `pending`, so `isLoading` alone would
      // report "still loading" forever for a user who hasn't picked a sign —
      // and the step would show a blank panel instead of the prompt that asks
      // them to pick one. Pair it with the gate, the way
      // `useAlarmSoundPreference` pairs `isPlaceholderData` with `userId`.
      isLoading: !!sunSign && isLoading,
    },
  ];
};
