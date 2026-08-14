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

// The live block, in a module-scoped slot rather than context — the
// `useViewedDay` pattern, with a subscription added because the accessory has to
// re-render when the block changes rather than read it once at press time.
//
// The reason it is a store at all is the tab-bar accessory: react-native-screens
// renders that element **twice at once**, one instance for the `regular`
// placement and one for `inline` (see `TabsHost.ios.js`). Two instances calling
// the query hooks directly would mean two query observers, two one-second
// intervals, and — the dangerous part — every write effect firing twice. So the
// accessory stays a dumb reader over one shared anchor, and the single publisher
// below owns every write.
let snapshot: TFocusTimerSnapshot = EMPTY_SNAPSHOT;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;

// Publishing a fresh object on every render would re-render every subscriber on
// every render — `useSyncExternalStore` compares snapshots by identity. Only the
// publisher's block-changed effect calls this.
const publish = (next: TFocusTimerSnapshot) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

/**
 * The live focus block and its controls, for surfaces that must not hold query
 * observers of their own.
 *
 * Two callers, for two different reasons. The tab-bar accessory is rendered
 * **twice at once** (above), so hooks there would double every observer and
 * every write. `MoreMenu` renders **once per task card**, so calling
 * `useLiveFocusBlock` there put a query observer and two mutation observers on
 * every row of a long list to read one shared value. This costs a `Set` entry
 * each and re-renders only when the block actually changes.
 *
 * Surfaces that own the timer rather than merely reading it — the bar itself —
 * still call `useLiveFocusBlock`; there are at most a couple of those.
 */
export const useFocusTimer = (): TFocusTimerSnapshot =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/**
 * How many whole seconds are left, ticking once a second while the block runs.
 *
 * Every tick **recomputes from `Date.now()`** rather than decrementing a
 * counter: `setInterval` drifts, and a decremented counter accumulates that
 * drift across a 25-minute block, where a recomputation cannot — and a
 * foregrounded app is instantly right instead of however many seconds behind it
 * spent suspended.
 *
 * Keep this behind a component that renders nothing but the countdown itself
 * (`FocusCountdown`), so a per-second render never reaches the surrounding bar.
 */
export const useFocusCountdown = (block: TFocusBlock | null): number => {
  // The clock is the state; the countdown is derived from it during render. The
  // other way round — storing the seconds and setting them from an effect —
  // needs a synchronous setState in the effect body to seed and to correct on a
  // block change, which cascades renders (react-hooks/set-state-in-effect).
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // A paused block's remaining time cannot move, and an ended one has none,
    // so neither holds an interval.
    if (block?.status !== "active") return;

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [block?.status]);

  // `now` lags the anchor between ticks — by a second while running, and by the
  // whole pause after a resume, since nothing ticks while a block is held.
  // `liveRemainingSeconds` clamps elapsed at zero for exactly that, so the worst
  // case is one stale tick rather than a countdown that jumps upward. Reading
  // the clock during render instead would make this impure for a difference
  // nobody can see.
  return block ? Math.ceil(liveRemainingSeconds(block, now)) : 0;
};

/**
 * Publishes the live block to the store above, and owns the write that ends a
 * block when its time runs out.
 *
 * **Call this exactly once**, from `components/FocusTimerHost.tsx` — inside the
 * providers, alive on every tab, and outside any single tab screen, so the
 * completion write neither depends on which screen is focused nor runs twice.
 * `confirm` comes from the host's `useConfirmation`, which renders the one
 * `ConfirmationModal` the stop prompt needs.
 */
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

  // The mutation callbacks are fresh closures every render. Publishing them
  // directly would republish (and re-render every subscriber) on every render,
  // so the store gets stable wrappers that delegate through this ref instead.
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

  // Built once and never rebuilt, so the published snapshot's identity tracks
  // the block alone. `useMemo` rather than a ref because a ref may not be read
  // during render (react-hooks/refs); these wrappers only touch `latest` when
  // they are actually called, which is always after render.
  const actions = useMemo<TFocusTimerActions>(
    () => ({
      // Stopping asks first, everywhere it is offered — the bar, the accessory,
      // and the task menu all route through here. A block records the time it
      // actually ran and there is no un-cancel, so a mis-tap twenty minutes in
      // costs the session. Hosting the prompt with the publisher rather than at
      // each call site is what lets the task menu offer this at all: `MoreMenu`
      // renders once per card and has nowhere of its own to put a modal.
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

  // Which block this mount has already completed. The timeout and the AppState
  // listener can both come due for the same block, and the row's own status is
  // no guard — both closures captured it while it was still `active`.
  const completed = useRef<string | null>(null);

  useEffect(() => {
    if (!block || block.status !== "active") return;

    const complete = () => {
      if (completed.current === block.id) return;
      if (liveRemainingSeconds(block, Date.now()) > 0) return;
      completed.current = block.id;
      latest.current.finishFocusBlock(block, {
        // Release the latch if the write never landed. Latching optimistically
        // is what stops the timeout and the AppState listener both completing
        // the same block, but holding it through a *failed* write would strand
        // the block: the optimistic clear rolls back, so it sits at 0:00 still
        // `active`, the one-live-block index refuses a new start, and Stop
        // records it `cancelled` — a finished session that never counts. Freed,
        // the next due signal (a foreground, or the next launch) retries.
        onError: () => {
          if (completed.current === block.id) completed.current = null;
        },
      });
    };

    // Already past due at mount — the app was closed or force-quit through the
    // end of the block. Because `date` was stamped when the block started, it
    // still counts toward the correct day however late this runs.
    const remainingMs = liveRemainingSeconds(block, Date.now()) * 1000;
    if (remainingMs <= 0) {
      complete();
      return;
    }

    // One timeout for the whole block rather than a per-second poll.
    const timeout = setTimeout(complete, remainingMs);

    // JS is frozen while the app is suspended, so the timeout fires late on
    // resume rather than on time. This makes that moment deterministic instead
    // of leaving it to how the runtime handles an overdue timer.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") complete();
    });

    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [block]);
};
