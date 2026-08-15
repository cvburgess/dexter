import { Temporal } from "@js-temporal/polyfill";

/**
 * How far back the canonical task fetch reaches by default — wide enough that
 * the Today list's recently-checked-off rows stay visible, bounded so the
 * payload doesn't grow with the account's full task history. Incomplete tasks
 * are never excluded by this window (DEX-57).
 *
 * A *floor*, not a ceiling, since DEX-162: navigating to an older day widens the
 * reach past it (see `reachFor`), and the fetch never narrows below this.
 */
export const DEFAULT_TASK_REACH_DAYS = 30;

/**
 * The reach that covers `date` — the first of that date's month.
 *
 * Snapped to a month rather than used verbatim so paging day by day past the
 * boundary doesn't refetch on every swipe (days are unbounded there, see
 * `SmallScreenToday`). One refetch per month crossed, and moving around inside a
 * month the user has already opened costs nothing.
 */
export const reachFor = (date: Temporal.PlainDate): Temporal.PlainDate =>
  date.with({ day: 1 });

/**
 * The effective reach: `explicit` when the user has opened something older than
 * the default window, otherwise `today - DEFAULT_TASK_REACH_DAYS`.
 *
 * `explicit` is stored as `null` until a screen actually asks for an older day,
 * and the default is resolved against a live `today` rather than frozen at first
 * read — which is what keeps the floor sliding correctly across midnight
 * (DEX-161). Taking the *earlier* of the two is what makes the reach
 * monotonically widen: an explicit reach inside the default window would
 * otherwise narrow the fetch and drop rows other views are already showing.
 */
export const resolveReach = (
  explicit: Temporal.PlainDate | null,
  today: Temporal.PlainDate,
): Temporal.PlainDate => {
  const floor = today.subtract({ days: DEFAULT_TASK_REACH_DAYS });
  if (!explicit) return floor;
  return Temporal.PlainDate.compare(explicit, floor) < 0 ? explicit : floor;
};
