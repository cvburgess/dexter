import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { msUntilNextDay } from "@/utils/dayRollover";

/**
 * The current calendar day, as a value screens can *subscribe* to (DEX-161).
 *
 * The bug this exists for: the day was read ad hoc at every call site, and the
 * three screens that hold one held it in a `useState` initializer — so an app
 * open before midnight kept yesterday until something happened to remount it.
 * A force-quit fixed it, which is what made it read as a bug rather than a
 * stale render.
 *
 * A module store rather than context, the `useFocusTimer` shape: the day is one
 * value for the whole tree, and nothing needs to override it per subtree.
 */
const listeners = new Set<() => void>();

let today = Temporal.Now.plainDateISO();

/**
 * **Reads the clock, and returns the same object until the day itself changes.**
 *
 * Both halves are load-bearing. `useSyncExternalStore` compares snapshots by
 * identity, so a fresh `PlainDate` per call would re-render every subscriber on
 * every render — and worse, `usePublishViewedDay` keys a focus effect on this
 * value, so a new identity tears that effect down and momentarily clears the
 * viewed day the nav rail's "+" reads (the bug `week/index.tsx` fixed by
 * memoizing on the ISO string).
 *
 * Reading the clock here rather than trusting the last publish is what makes a
 * missed notification a *delay* instead of a stuck value: the watcher below is
 * the only thing that re-renders subscribers at the boundary, but any render
 * from any other cause corrects the day on its way through.
 */
const getSnapshot = (): Temporal.PlainDate => {
  const now = Temporal.Now.plainDateISO();
  if (!now.equals(today)) today = now;
  return today;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notify = () => listeners.forEach((listener) => listener());

/** Today, re-rendering the caller when the day changes underneath it. */
export const useToday = (): Temporal.PlainDate =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/**
 * Drives the day change. **Call this exactly once**, from `(app)/_layout.tsx`.
 *
 * Two signals into one idempotent `notify`, the pairing `useFocusTimer`'s
 * completion effect uses and for the same reason: a timer anchored on the next
 * boundary catches an app left open across it, and `AppState` catches the far
 * commoner case where the app was suspended and that timer fired however long
 * late. Re-arming from the foreground pass is what keeps the timer anchored to
 * a boundary rather than to whenever it last drifted awake.
 *
 * Not an interval — `docs/frontend.md`'s no-polling rule (DEX-36) stands, and
 * this wakes once a day. Web needs no special case: react-native-web implements
 * `AppState` over `visibilitychange`, and a visible tab's timers aren't
 * throttled. It returns nothing at all when there is no DOM, hence the `?.`.
 */
export const useDayRollover = (): void => {
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const arm = () => {
      timeout = setTimeout(() => {
        notify();
        arm();
      }, msUntilNextDay(Temporal.Now.zonedDateTimeISO()));
    };

    arm();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      notify();
      clearTimeout(timeout);
      arm();
    });

    return () => {
      clearTimeout(timeout);
      subscription?.remove();
    };
  }, []);
};
