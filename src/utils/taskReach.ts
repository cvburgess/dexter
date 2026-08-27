import { Temporal } from "@js-temporal/polyfill";

/**
 * Default reach of the canonical task fetch — a *floor*, not a ceiling (DEX-162).
 * Incomplete tasks are never excluded by this window (DEX-57).
 */
export const DEFAULT_TASK_REACH_DAYS = 30;

/**
 * Snapped to the first of the month so day-by-day paging refetches once per
 * month crossed, not on every swipe (DEX-162).
 */
export const reachFor = (date: Temporal.PlainDate): Temporal.PlainDate =>
  date.with({ day: 1 });

/**
 * Resolved against a live `today` so the floor slides across midnight (DEX-161);
 * taking the *earlier* of the two keeps the reach monotonically widening.
 */
export const resolveReach = (
  explicit: Temporal.PlainDate | null,
  today: Temporal.PlainDate,
): Temporal.PlainDate => {
  const floor = today.subtract({ days: DEFAULT_TASK_REACH_DAYS });
  if (!explicit) return floor;
  return Temporal.PlainDate.compare(explicit, floor) < 0 ? explicit : floor;
};
