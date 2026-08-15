import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useSyncExternalStore } from "react";

import { reachFor, resolveReach } from "@/utils/taskReach";

import { useToday } from "./useToday";

/**
 * How far back the canonical `["tasks"]` fetch currently reaches (DEX-162).
 *
 * The canonical fetch covers every open task plus anything scheduled inside its
 * reach, and every view slices that one cached array (DEX-57). That made days
 * older than the default window look empty of *closed-out* work — the bug this
 * store fixes: a screen showing an older day widens the reach, the one query
 * refetches, and every existing selector keeps working unchanged.
 *
 * A module store rather than context, for the reasons `useToday` spells out: the
 * reach is one value for the whole tree, and `useTasks` mounts in a dozen places
 * that must all agree on which query key they are reading.
 */
const listeners = new Set<() => void>();

/**
 * `null` until a screen asks for a day older than the default window. Only ever
 * moves earlier — see `resolveReach`, and `expandTaskReach` below.
 */
let explicitReach: Temporal.PlainDate | null = null;

const getSnapshot = (): Temporal.PlainDate | null => explicitReach;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Widens the reach to cover `date`, and reports whether it moved.
 *
 * A no-op when `date` is already covered, which is the common case — every
 * ordinary day change re-runs this. "Covered" includes the default window, so
 * opening today doesn't record a reach that resolves to the same floor anyway
 * and wake every subscriber for nothing. Exported for tests; screens call
 * `useExpandTaskReach`.
 */
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

/**
 * The effective reach, re-rendering the caller when it widens.
 *
 * Subscribed to `useToday` as well as the store: the default floor is relative
 * to today, so a day rollover moves it without anyone touching `explicitReach`.
 */
export const useTaskReach = (): Temporal.PlainDate => {
  const today = useToday();
  const explicit = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return resolveReach(explicit, today);
};

/**
 * Widens the reach to cover `date` while the calling screen shows it — the
 * three screens that own a viewed day (Today, Week, Ritual).
 *
 * In an effect rather than during render because widening starts a fetch. The
 * frame between is covered without a flash of "no tasks": the reach is part of
 * the query key, so the refetch reads as `isLoading` while
 * `placeholderData: keepPreviousData` holds the rows already on screen (see
 * `useTasks`).
 *
 * The Week tab passes its Monday — the week's earliest day, so widening for it
 * covers all seven columns.
 */
export const useExpandTaskReach = (date: Temporal.PlainDate): void => {
  useEffect(() => {
    expandTaskReach(date);
    // Keyed on the ISO string, not the `PlainDate`: the screens hand back a
    // fresh object whenever they rebuild their day state, and the reach only
    // cares about the value.
  }, [date.toString()]); // eslint-disable-line react-hooks/exhaustive-deps
};
