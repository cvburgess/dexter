import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useSyncExternalStore } from "react";

import { reachFor, resolveReach } from "@/utils/taskReach";

import { useToday } from "./useToday";

// How far back the canonical ["tasks"] fetch reaches (DEX-162) — an older
// day widens it, fixing older days looking empty of closed-out work (DEX-57).
const listeners = new Set<() => void>();

// null until a screen asks for a day older than the default window. Only
// ever moves earlier — see resolveReach, and expandTaskReach below.
let explicitReach: Temporal.PlainDate | null = null;

const getSnapshot = (): Temporal.PlainDate | null => explicitReach;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Widens the reach to cover `date`, reporting whether it moved — a no-op
// when already covered, so an ordinary day change wakes no subscribers.
export const expandTaskReach = (date: Temporal.PlainDate): boolean => {
  const next = reachFor(date);
  const current = resolveReach(explicitReach, Temporal.Now.plainDateISO());
  if (Temporal.PlainDate.compare(next, current) >= 0) return false;

  explicitReach = next;
  listeners.forEach((listener) => listener());
  return true;
};

/** Resets the reach. Test-only — the app widens for the life of the process. */
export const resetTaskReach = () => {
  explicitReach = null;
  listeners.forEach((listener) => listener());
};

// The effective reach, re-rendering the caller when it widens. Subscribed
// to useToday too: the default floor is relative to today.
export const useTaskReach = (): Temporal.PlainDate => {
  const today = useToday();
  const explicit = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return resolveReach(explicit, today);
};

// Widens the reach to cover `date` while the screen shows it (Today, Week,
// Ritual) — in an effect since widening starts a fetch, no-flash via keepPreviousData.
export const useExpandTaskReach = (date: Temporal.PlainDate): void => {
  useEffect(() => {
    expandTaskReach(date);
    // Keyed on the ISO string, not the PlainDate — screens hand back a fresh
    // object per rebuild, and the reach only cares about the value.
  }, [date.toString()]); // eslint-disable-line react-hooks/exhaustive-deps
};
