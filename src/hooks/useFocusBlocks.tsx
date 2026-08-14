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

/** Shared by the full hook below and `useLiveFocusBlockId`, so the two observe
 * one query rather than two hand-copied definitions — `preferencesQueryOptions`
 * exists for the same reason. */
const liveFocusBlockQueryOptions = queryOptions({
  queryKey: LIVE_FOCUS_BLOCK_KEY,
  queryFn: () => getLiveFocusBlock(supabase),
});

/**
 * Exported so `useRealtimeInvalidation` shares this definition instead of a
 * hand-copied one that could drift. The bare `["focusBlocks"]` prefix covers
 * both the live row and every per-date list, so a block that ends on another
 * device refreshes the timer bar *and* tonight's Review figure.
 */
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

/**
 * The focus block currently on screen, and the five transitions that move it
 * (DEX-49).
 *
 * Every transition writes the anchor — `remaining_seconds` *and* `resumed_at`
 * together — because the `resumed_at_iff_active` constraint rejects a running
 * block with no anchor and a stopped one still carrying one. Nothing here writes
 * a per-second countdown; see `utils/focusBlocks.ts`.
 */
export const useLiveFocusBlock = (): TUseLiveFocusBlock => {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const { data: block, isLoading } = useQuery({
    ...liveFocusBlockQueryOptions,
    // Gated on `userId` for the same reason `usePreferences` is: this hook is
    // mounted at the root of the authenticated tree, where its effects still run
    // during the auth-initializing pass, and RLS would reject the read.
    enabled: !!userId,
  });

  const invalidate = () => {
    FOCUS_BLOCKS_INVALIDATION_KEYS.forEach((queryKey) => {
      void queryClient.invalidateQueries({ queryKey });
    });
  };

  const { mutate: start } = useMutation<TFocusBlock, Error, string>({
    mutationFn: async (taskId) => {
      // `ensureQueryData`, not a `usePreferences()` call in the component: the
      // only caller is the task card's menu, which renders once per card, so an
      // observer there would re-render the whole list on any unrelated
      // preference edit. Reading `defaultPreferences` instead would start a
      // 25-minute block for someone who chose 50 but hasn't loaded their row
      // yet — this awaits the saved value exactly once.
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
    // Optimistic so the play/pause glyph flips on the tap rather than a round
    // trip later. A transition to an ended status clears the live row outright,
    // which is what takes the bar off screen.
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

  // Rounded up, matching what the countdown was reading at the moment of the
  // tap — pausing at a displayed `12:01` and resuming to `12:00` would look like
  // the timer had lost a second to the tap itself.
  const snapshot = (block: TFocusBlock) =>
    Math.ceil(liveRemainingSeconds(block, Date.now()));

  // Every transition is a no-op on a block that has already ended. The guard is
  // what makes `finishFocusBlock` idempotent: the completion timeout and the
  // AppState listener can both fire for the same block, and the second must not
  // reopen or rewrite it.
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
      // The only transition that takes callbacks: its caller latches the block
      // id so the timeout and the AppState listener can't both write it, and
      // needs to know when to release that latch (see `usePublishFocusTimer`).
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

/**
 * Whether a block is live, and which one — for a reader that needs to know a
 * block exists without the five mutations `useLiveFocusBlock` builds.
 *
 * `useAlarmSync` is the caller (DEX-156): the running block's timer is an
 * AlarmKit alarm it must not cancel, and mounting the full hook at the root of
 * the tree would add mutation observers to read one string. `select` narrows the
 * re-render to an id change, so a pause or a tick down doesn't reach it.
 */
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

/**
 * One local day's blocks, for the evening ritual's Review figure. Read-only —
 * a past day's blocks are a record, and the only surface that writes one is the
 * live timer above.
 */
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
