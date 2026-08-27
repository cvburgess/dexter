import { Temporal } from "@js-temporal/polyfill";

/**
 * Leaf primitives shared by the deep-link modules (DEX-105) — kept here so the
 * route modules don't have to import each other.
 */

/** A route param, which arrives as a string, an array, or not at all. */
export type TRouteParam = string | string[] | undefined;

/** Route params are `string[]` when a key is repeated in the URL; take the first. */
export const firstParam = (value: TRouteParam): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Web URLs are hand-editable and `Temporal.PlainDate.from` throws on malformed
 * and impossible dates — a bad param falls back to today, not a crash.
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
 * Tells "this link changed" from "followed again". Absent from a hand-typed
 * URL, whose id then derives from contents alone and applies exactly once.
 */
export const linkNonce = (value: TRouteParam): string =>
  firstParam(value) ?? "";
