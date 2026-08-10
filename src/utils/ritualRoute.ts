import { Temporal } from "@js-temporal/polyfill";
import type { Href } from "expo-router";

import {
  firstParam,
  linkNonce,
  parseDayDate,
  type TRouteParam,
} from "@/utils/routeParams";
import { RITUAL_STEP_IDS, type TRitualStepId } from "@/utils/ritualSteps";

/**
 * The Ritual tab's deep-link contract (DEX-105), both directions — the builder
 * below and the parser beside it, in one module so a change to the format can't
 * update one side and leave the other reading the old shape. The same split
 * `utils/todayRoute.ts` uses, and for the same reason.
 *
 * The link names a **step, not a mode**: `journal` (its only caller today, from
 * a search result) is a step of both the morning and the evening ritual, so the
 * tab keeps choosing which flow by the clock. The consequence worth knowing is
 * that a bookmarked link renders a different ritual before and after noon —
 * acceptable, since the mode is a property of *now* rather than of the link,
 * and a `?mode=` param stays trivially addable if that changes.
 */

/** The requested step, or null when absent or unrecognized. */
export const parseRitualStep = (value: TRouteParam): TRitualStepId | null => {
  const step = firstParam(value);
  return RITUAL_STEP_IDS.includes(step as TRitualStepId)
    ? (step as TRitualStepId)
    : null;
};

type TRitualRouteParams = {
  date?: string;
  step?: TRitualStepId;
  /**
   * Distinguishes one navigation from the next.
   *
   * Cross-tab navigation reuses the mounted Ritual screen and only swaps its
   * params, so the screen can only tell "this link changed" by comparing values
   * — and two taps on the same search result produce identical values. See
   * `TTodayRouteParams["n"]`, which carries the full reasoning.
   */
  n?: string;
};

/** The Ritual tab, optionally pointed at a specific day and step. */
export const ritualRoute = (params: TRitualRouteParams = {}): Href => {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== "",
  );

  return entries.length > 0
    ? { pathname: "/ritual", params: Object.fromEntries(entries) }
    : "/ritual";
};

/**
 * Everything the Ritual tab needs from its route params, with an `id` that
 * changes whenever the link is *followed* rather than only when its contents
 * differ. Null when the route carries no link at all (an ordinary tab press).
 */
export type TRitualLink = {
  id: string;
  date: Temporal.PlainDate | null;
  step: TRitualStepId | null;
};

type TRitualLinkParams = {
  date?: TRouteParam;
  step?: TRouteParam;
  n?: TRouteParam;
};

export const parseRitualLink = (
  params: TRitualLinkParams,
): TRitualLink | null => {
  const date = parseDayDate(params.date);
  const step = parseRitualStep(params.step);

  // Neither a day nor a step named: nothing to apply, so the tab behaves as if
  // it were pressed normally.
  if (!date && !step) return null;

  return {
    id: `${linkNonce(params.n)}|${date?.toString() ?? ""}|${step ?? ""}`,
    date,
    step,
  };
};
