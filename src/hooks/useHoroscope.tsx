import { useQuery } from "@tanstack/react-query";

import { getHoroscope, THoroscope, TSunSign } from "@/api/horoscopes";

import { supabase } from "./useAuth";

type TUseHoroscope = [
  /** The day's prediction, or `null` when the generator hasn't covered it. */
  THoroscope | null,
  { isLoading: boolean },
];

// One day's horoscope for one sign (DEX-128). Not wired to
// useRealtimeInvalidation — not in the realtime publication.
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
      // A disabled query never leaves `pending`, so pair with the gate or a
      // user with no sign chosen sees a blank panel forever, not the prompt.
      isLoading: !!sunSign && isLoading,
    },
  ];
};
