import { Temporal } from "@js-temporal/polyfill";

/**
 * The primitives every deep-link module shares: how a route param arrives, and
 * how a day is read back out of one.
 *
 * Split out of `utils/todayRoute.ts` when the Ritual tab gained a link contract
 * of its own (DEX-105). Both route modules need these, and `todayRoute` also
 * builds a ritual route for a journal search result — so leaving them where
 * they were would have made the two modules import each other. A leaf they can
 * both depend on is the same shape `utils/taskStatus.ts` already has.
 */

/** A route param, which arrives as a string, an array, or not at all. */
export type TRouteParam = string | string[] | undefined;

/** Route params are `string[]` when a key is repeated in the URL; take the first. */
export const firstParam = (value: TRouteParam): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * The requested day, or null when absent or unparseable.
 *
 * A hand-edited or stale URL is a real source of garbage here (these routes are
 * linkable on web), and `Temporal.PlainDate.from` throws on both a malformed
 * string and an impossible date like `2026-02-30` — so a bad param falls back
 * to today rather than crashing the tab.
 */
export const parseDayDate = (value: TRouteParam): Temporal.PlainDate | null => {
  const date = firstParam(value);
  if (!date) return null;

  try {
    return Temporal.PlainDate.from(date);
  } catch {
    return null;
  }
};

/**
 * The `n` nonce folded into a link's id, so a guard can tell "this link
 * changed" from "the user followed the same link again".
 *
 * Absent from a hand-written or bookmarked URL, in which case the id derives
 * purely from the link's contents and it applies exactly once — the right
 * behavior for a link that was typed rather than tapped.
 */
export const linkNonce = (value: TRouteParam): string =>
  firstParam(value) ?? "";
