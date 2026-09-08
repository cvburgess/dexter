import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

// A per-device record (like useTodayPanes), so AsyncStorage rather than the
// synced preferences row: this gates a render decision, not a setting.
export const SEEN_RITUAL_STEPS_KEY = "dexter.ritual.seenSteps";

/**
 * Scoped to a single day rather than a flat list of date-prefixed keys —
 * "fresh again tomorrow" is then structural, and the blob cannot grow.
 */
export type TSeenSteps = {
  /** ISO date the keys belong to; `""` when nothing has been recorded. */
  date: string;
  /** `stepVisitKey` values seen on that date. */
  keys: string[];
};

const NOTHING_SEEN: TSeenSteps = { date: "", keys: [] };

const isSeenSteps = (value: unknown): value is TSeenSteps =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as TSeenSteps).date === "string" &&
  Array.isArray((value as TSeenSteps).keys) &&
  (value as TSeenSteps).keys.every((key) => typeof key === "string");

const readSeen = async (): Promise<TSeenSteps> => {
  const raw = await AsyncStorage.getItem(SEEN_RITUAL_STEPS_KEY);
  if (!raw) return NOTHING_SEEN;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSeenSteps(parsed) ? parsed : NOTHING_SEEN;
  } catch {
    return NOTHING_SEEN;
  }
};

type TUseSeenRitualSteps = [
  TSeenSteps,
  {
    markSeen: (date: string, key: string) => Promise<void>;
    isLoading: boolean;
  },
];

/** Which ritual steps have already played their arrival on a given day
 * (DEX-199). `enabled` false skips the read for a caller that already knows
 * the answer — a ritual for any day but today never animates. */
export const useSeenRitualSteps = (enabled = true): TUseSeenRitualSteps => {
  const queryClient = useQueryClient();

  const { data = NOTHING_SEEN, isLoading } = useQuery({
    queryKey: ["seenRitualSteps"],
    queryFn: readSeen,
    enabled,
    staleTime: Infinity,
    // Without this the default 5-minute collection would drop the cache
    // between ritual sessions and pay the read again mid-reveal.
    gcTime: Infinity,
  });

  /** Derives the next value via setQueryData's updater form (synchronous), not
   * closed-over `data`, so several drivers marking in one tick don't clobber. */
  const markSeen = useCallback(
    async (date: string, key: string) => {
      let previous: TSeenSteps | undefined;
      const next = queryClient.setQueryData<TSeenSteps>(
        ["seenRitualSteps"],
        (prev = NOTHING_SEEN) => {
          previous = prev;
          if (prev.date !== date) return { date, keys: [key] };
          // Same object back when already recorded, so the write below skips.
          if (prev.keys.includes(key)) return prev;
          return { date, keys: [...prev.keys, key] };
        },
      );
      if (next && next !== previous) {
        await AsyncStorage.setItem(SEEN_RITUAL_STEPS_KEY, JSON.stringify(next));
      }
    },
    [queryClient],
  );

  return [data, { markSeen, isLoading }];
};
