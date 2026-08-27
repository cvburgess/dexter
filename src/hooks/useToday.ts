import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { msUntilNextDay } from "@/utils/dayRollover";

// The current calendar day, subscribable (DEX-161) — a useState initializer
// kept yesterday until a force-quit; this is a useFocusTimer-shaped store instead.
const listeners = new Set<() => void>();

let today = Temporal.Now.plainDateISO();

// Reads the clock, returns the same object until the day changes: identity
// matters, or a fresh PlainDate would tear down usePublishViewedDay's effect.
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

// Drives the day change. Call once, from (app)/_layout.tsx: a boundary
// timer plus AppState into one notify — not an interval (DEX-36).
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
