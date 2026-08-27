import { Temporal } from "@js-temporal/polyfill";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createFocusBlock,
  getFocusBlocks,
  getLiveFocusBlock,
  TFocusBlock,
  TUpdateFocusBlock,
  updateFocusBlock,
} from "@/api/focusBlocks";
import {
  isLiveFocusStatus,
  liveRemainingSeconds,
  resolveFocusBlockMinutes,
} from "@/utils/focusBlocks";

import { supabase, useAuth } from "./useAuth";
import { preferencesQueryOptions } from "./usePreferences";

/** The running-or-held block, if any. One row, one key. */
const LIVE_FOCUS_BLOCK_KEY = ["focusBlocks", "live"];

/** Shared with useLiveFocusBlockId, so the two observe one query rather
 * than two hand-copied definitions. */
const liveFocusBlockQueryOptions = queryOptions({
  queryKey: LIVE_FOCUS_BLOCK_KEY,
  queryFn: () => getLiveFocusBlock(supabase),
});

// Shared with useRealtimeInvalidation. The bare prefix covers the live row
// and every per-date list, so a remote edit refreshes bar and Review together.
export const FOCUS_BLOCKS_INVALIDATION_KEYS = [["focusBlocks"]];

type TMutateCallbacks = {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
};

type TUseLiveFocusBlock = [
  TFocusBlock | null,
  {
    cancelFocusBlock: (block: TFocusBlock) => void;
    finishFocusBlock: (
      block: TFocusBlock,
      callbacks?: TMutateCallbacks,
    ) => void;
    isLoading: boolean;
    pauseFocusBlock: (block: TFocusBlock) => void;
    resumeFocusBlock: (block: TFocusBlock) => void;
    startFocusBlock: (taskId: string) => void;
  },
];

// The live block and its five transitions (DEX-49). Each writes the whole
// anchor — resumed_at_iff_active rejects a partial one. No per-second writes.
export const useLiveFocusBlock = (): TUseLiveFocusBlock => {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const { data: block, isLoading } = useQuery({
    ...liveFocusBlockQueryOptions,
    // Gated like `usePreferences`: effects run during the auth-initializing
    // pass at the tree root, where RLS would reject the read.
    enabled: !!userId,
  });

  const invalidate = () => {
    FOCUS_BLOCKS_INVALIDATION_KEYS.forEach((queryKey) => {
      void queryClient.invalidateQueries({ queryKey });
    });
  };

  const { mutate: start } = useMutation<TFocusBlock, Error, string>({
    mutationFn: async (taskId) => {
      // `ensureQueryData`, not `usePreferences()`: per-card MoreMenu can't
      // hold an observer, and defaults would ignore an unloaded saved value.
      const preferences = await queryClient.ensureQueryData(
        preferencesQueryOptions,
      );
      const totalSeconds =
        resolveFocusBlockMinutes(preferences.focusBlockMinutes) * 60;

      return createFocusBlock(supabase, {
        // The **local** day, stamped once. A block running past midnight stays
        // on the day it was begun.
        date: Temporal.Now.plainDateISO().toString(),
        remainingSeconds: totalSeconds,
        resumedAt: new Date().toISOString(),
        taskId,
        totalSeconds,
      });
    },
    onSuccess: (created) => {
      queryClient.setQueryData<TFocusBlock | null>(
        LIVE_FOCUS_BLOCK_KEY,
        created,
      );
      invalidate();
    },
  });

  const { mutate: transition } = useMutation<
    TFocusBlock,
    Error,
    TUpdateFocusBlock,
    { previous?: TFocusBlock | null }
  >({
    mutationFn: (diff) => updateFocusBlock(supabase, diff),
    // Optimistic so the play/pause glyph flips on the tap; a transition to an
    // ended status clears the live row, taking the bar off screen.
    onMutate: async (diff) => {
      await queryClient.cancelQueries({ queryKey: LIVE_FOCUS_BLOCK_KEY });
      const previous = queryClient.getQueryData<TFocusBlock | null>(
        LIVE_FOCUS_BLOCK_KEY,
      );
      queryClient.setQueryData<TFocusBlock | null>(
        LIVE_FOCUS_BLOCK_KEY,
        (current) => {
          if (!current || current.id !== diff.id) return current ?? null;
          const next = { ...current, ...diff };
          return isLiveFocusStatus(next.status) ? next : null;
        },
      );
      return { previous };
    },
    onError: (_error, _diff, context) => {
      if (context) {
        queryClient.setQueryData(
          LIVE_FOCUS_BLOCK_KEY,
          context.previous ?? null,
        );
      }
    },
    onSettled: invalidate,
  });

  // Rounded up to match the displayed countdown — pausing at `12:01` and
  // resuming to `12:00` would look like the tap itself cost a second.
  const snapshot = (block: TFocusBlock) =>
    Math.ceil(liveRemainingSeconds(block, Date.now()));

  // The guard makes `finishFocusBlock` idempotent: the timeout and AppState
  // listener can both fire, and the second must not reopen the block.
  const move = (
    block: TFocusBlock,
    diff: Omit<TUpdateFocusBlock, "id">,
    callbacks?: TMutateCallbacks,
  ) => {
    if (!isLiveFocusStatus(block.status)) return;
    transition({ id: block.id, ...diff }, callbacks);
  };

  return [
    block ?? null,
    {
      cancelFocusBlock: (block) =>
        move(block, {
          remainingSeconds: snapshot(block),
          resumedAt: null,
          status: "cancelled",
        }),
      // Callbacks exist so `usePublishFocusTimer` knows when to release its
      // completion latch.
      finishFocusBlock: (block, callbacks) =>
        move(
          block,
          { remainingSeconds: 0, resumedAt: null, status: "complete" },
          callbacks,
        ),
      isLoading,
      pauseFocusBlock: (block) =>
        move(block, {
          remainingSeconds: snapshot(block),
          resumedAt: null,
          status: "paused",
        }),
      // `remainingSeconds` is deliberately left alone — the snapshot taken at
      // the pause is still correct, and only the anchor moves.
      resumeFocusBlock: (block) =>
        move(block, {
          resumedAt: new Date().toISOString(),
          status: "active",
        }),
      startFocusBlock: start,
    },
  ];
};

// The live block's id without useLiveFocusBlock's mutation observers, for
// useAlarmSync's sweep guard (DEX-156).
export const useLiveFocusBlockId = (): {
  id: string | null;
  isLoading: boolean;
} => {
  const { userId } = useAuth();

  const { data, isLoading } = useQuery({
    ...liveFocusBlockQueryOptions,
    enabled: !!userId,
    select: (block) => block?.id ?? null,
  });

  return { id: data ?? null, isLoading };
};

type TUseFocusBlocks = [TFocusBlock[], { isLoading: boolean }];

// One local day's blocks, for the Review figure. Read-only — a past day's
// blocks are a record; only the live timer above writes one.
export const useFocusBlocks = (
  date: string,
  options?: { skipQuery?: boolean },
): TUseFocusBlocks => {
  const { userId } = useAuth();

  const { data: blocks = [], isLoading } = useQuery({
    enabled: !!userId && !options?.skipQuery,
    queryKey: ["focusBlocks", date],
    queryFn: () => getFocusBlocks(supabase, date),
  });

  return [blocks, { isLoading }];
};
