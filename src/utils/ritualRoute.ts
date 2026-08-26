import { Temporal } from "@js-temporal/polyfill";
import type { Href } from "expo-router";

import {
  firstParam,
  linkNonce,
  parseDayDate,
  type TRouteParam,
} from "@/utils/routeParams";
import {
  RITUAL_STEP_IDS,
  type TRitualMode,
  type TRitualStepId,
} from "@/utils/ritualSteps";

/**
 * The Ritual tab's deep-link contract (DEX-105), both directions — the builder
 * below and the parser beside it, in one module so a change to the format can't
 * update one side and leave the other reading the old shape. The same split
 * `utils/todayRoute.ts` uses, and for the same reason.
 *
 * **`mode` is optional, and omitting it is the normal case.** A link that names
 * no ritual lets the clock choose, which is what a search result wants: the
 * journal entry you tapped belongs to today, and which half of the day you are
 * in is a property of *now* rather than of the link.
 *
 * Naming it matters when the same screen has to come back twice. `horoscope`
 * exists only in the morning ritual, so `?step=horoscope` followed after noon
 * lands nowhere in particular, and `journal` renders a different flow either
 * side of midday. A shared link, or a screenshot run that must produce the same
 * image at any hour, needs to say which one it means.
 *
 * Order matters where this is applied: `withMode` restarts the ritual at step
 * 0, so the mode has to be settled *before* the step is followed, never after.
 */

/** The requested step, or null when absent or unrecognized. */
export const parseRitualStep = (value: TRouteParam): TRitualStepId | null => {
  const step = firstParam(value);
  return RITUAL_STEP_IDS.includes(step as TRitualStepId)
    ? (step as TRitualStepId)
    : null;
};

/**
 * The requested ritual, or null when absent or unrecognized — in which case the
 * clock still chooses, which is what an ordinary link should do.
 *
 * Naming the mode is what makes a ritual link reproducible: `horoscope` is a
 * morning-only step, so `?step=horoscope` followed after noon lands nowhere in
 * particular, and `journal` renders a different ritual either side of midday.
 * Anything that needs the same screen twice — a shared link, an App Store
 * screenshot run — has to be able to say which half of the day it means.
 */
export const parseRitualMode = (value: TRouteParam): TRitualMode | null => {
  const mode = firstParam(value);
  return mode === "am" || mode === "pm" ? mode : null;
};

type TRitualRouteParams = {
  date?: string;
  /** Which ritual to show, when the clock's answer is not the wanted one. */
  mode?: TRitualMode;
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
  mode: TRitualMode | null;
  step: TRitualStepId | null;
};

type TRitualLinkParams = {
  date?: TRouteParam;
  mode?: TRouteParam;
  step?: TRouteParam;
  n?: TRouteParam;
};

export const parseRitualLink = (
  params: TRitualLinkParams,
): TRitualLink | null => {
  const date = parseDayDate(params.date);
  const mode = parseRitualMode(params.mode);
  const step = parseRitualStep(params.step);

  // No day, ritual, or step named: nothing to apply, so the tab behaves as if
  // it were pressed normally.
  if (!date && !mode && !step) return null;

  return {
    id: `${linkNonce(params.n)}|${date?.toString() ?? ""}|${mode ?? ""}|${step ?? ""}`,
    date,
    mode,
    step,
  };
};
