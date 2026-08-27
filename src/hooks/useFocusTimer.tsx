import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";

import { TFocusBlock } from "@/api/focusBlocks";
import type { ConfirmOptions } from "@/hooks/useConfirmation";
import { liveRemainingSeconds } from "@/utils/focusBlocks";

import { useFocusAlarmSync } from "./useFocusAlarmSync";
import { useLiveFocusBlock } from "./useFocusBlocks";

export type TFocusTimerActions = {
  cancelFocusBlock: (block: TFocusBlock) => void;
  pauseFocusBlock: (block: TFocusBlock) => void;
  resumeFocusBlock: (block: TFocusBlock) => void;
  startFocusBlock: (taskId: string) => void;
};

export type TFocusTimerSnapshot = {
  actions: TFocusTimerActions;
  block: TFocusBlock | null;
};

const NO_OP_ACTIONS: TFocusTimerActions = {
  cancelFocusBlock: () => {},
  pauseFocusBlock: () => {},
  resumeFocusBlock: () => {},
  startFocusBlock: () => {},
};

const EMPTY_SNAPSHOT: TFocusTimerSnapshot = {
  actions: NO_OP_ACTIONS,
  block: null,
};

// react-native-screens renders the tab-bar accessory twice at once (regular +
// inline placements), so it must stay a dumb reader; the publisher owns writes.
let snapshot: TFocusTimerSnapshot = EMPTY_SNAPSHOT;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;

// `useSyncExternalStore` compares snapshots by identity, so only the
// publisher's block-changed effect may call this.
const publish = (next: TFocusTimerSnapshot) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

// The live block for surfaces that must not hold query observers: the
// twice-rendered accessory and per-card MoreMenu. Owners use useLiveFocusBlock.
export const useFocusTimer = (): TFocusTimerSnapshot =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

// Whole seconds left, recomputed from Date.now() each tick — a decremented
// counter drifts and lags after suspension. Keep behind FocusCountdown.
export const useFocusCountdown = (block: TFocusBlock | null): number => {
  // The clock is the state; seconds are derived in render. Storing seconds
  // needs a sync setState in effects (react-hooks/set-state-in-effect).
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // A paused block's remaining time cannot move, and an ended one has none,
    // so neither holds an interval.
    if (block?.status !== "active") return;

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [block?.status]);

  // `now` lags the anchor between ticks; `liveRemainingSeconds` clamps elapsed
  // at zero, so the worst case is one stale tick, never an upward jump.
  return block ? Math.ceil(liveRemainingSeconds(block, now)) : 0;
};

// Publishes the live block and owns the completion write. Call exactly
// once, from FocusTimerHost — alive on every tab, outside any single screen.
export const usePublishFocusTimer = (
  confirm: (options: ConfirmOptions) => Promise<boolean>,
): void => {
  const [
    block,
    {
      cancelFocusBlock,
      finishFocusBlock,
      pauseFocusBlock,
      resumeFocusBlock,
      startFocusBlock,
    },
  ] = useLiveFocusBlock();

  // Mutation callbacks are fresh closures every render; the store gets stable
  // wrappers delegating through this ref so publishes track the block alone.
  const latest = useRef({
    cancelFocusBlock,
    confirm,
    finishFocusBlock,
    pauseFocusBlock,
    resumeFocusBlock,
    startFocusBlock,
  });

  useEffect(() => {
    latest.current = {
      cancelFocusBlock,
      confirm,
      finishFocusBlock,
      pauseFocusBlock,
      resumeFocusBlock,
      startFocusBlock,
    };
  });

  // `useMemo` rather than a ref: a ref may not be read during render
  // (react-hooks/refs); these only touch `latest` when called, after render.
  const actions = useMemo<TFocusTimerActions>(
    () => ({
      // There is no un-cancel, so stopping always asks first. The prompt lives
      // with the publisher because per-card MoreMenu has nowhere for a modal.
      cancelFocusBlock: (block) => {
        void latest.current
          .confirm({
            title: "Stop focus block?",
            message:
              "This block won't count toward today's focus blocks. You can start another one whenever you like.",
            confirmLabel: "Stop",
            destructive: true,
          })
          .then((confirmed) => {
            if (confirmed) latest.current.cancelFocusBlock(block);
          });
      },
      pauseFocusBlock: (block) => latest.current.pauseFocusBlock(block),
      resumeFocusBlock: (block) => latest.current.resumeFocusBlock(block),
      startFocusBlock: (taskId) => latest.current.startFocusBlock(taskId),
    }),
    [],
  );

  useEffect(() => {
    publish({ actions, block });
    // Clearing on unmount is what stops a signed-out accessory from drawing a
    // timer belonging to the account that just left.
    return () => publish(EMPTY_SNAPSHOT);
  }, [actions, block]);

  // The native countdown is a write, so it belongs to the single publisher —
  // a twice-rendered surface would schedule it twice.
  useFocusAlarmSync(block);

  // The timeout and AppState listener can both come due for one block, and
  // both closures captured its status while still `active` — hence this latch.
  const completed = useRef<string | null>(null);

  useEffect(() => {
    if (!block || block.status !== "active") return;

    const complete = () => {
      if (completed.current === block.id) return;
      if (liveRemainingSeconds(block, Date.now()) > 0) return;
      completed.current = block.id;
      latest.current.finishFocusBlock(block, {
        // Holding the latch through a failed write would strand the block at
        // 0:00 still `active`; freed, the next foreground or launch retries.
        onError: () => {
          if (completed.current === block.id) completed.current = null;
        },
      });
    };

    // Past due at mount (app killed through the end): `date` was stamped at
    // start, so it still counts toward the correct day however late this runs.
    const remainingMs = liveRemainingSeconds(block, Date.now()) * 1000;
    if (remainingMs <= 0) {
      complete();
      return;
    }

    // One timeout for the whole block rather than a per-second poll.
    const timeout = setTimeout(complete, remainingMs);

    // JS freezes while suspended, so the timeout fires late on resume; this
    // makes that moment deterministic rather than runtime-dependent.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") complete();
    });

    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [block]);
};
