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

// The Ritual tab's deep-link contract (DEX-105), both directions, in one
// module. Apply `mode` before `step` — `withMode` restarts at step 0.

/** The requested step, or null when absent or unrecognized. */
export const parseRitualStep = (value: TRouteParam): TRitualStepId | null => {
  const step = firstParam(value);
  return RITUAL_STEP_IDS.includes(step as TRitualStepId)
    ? (step as TRitualStepId)
    : null;
};

/**
 * The requested ritual, or null when absent/unrecognized — the clock then
 * chooses, which is what an ordinary link should do.
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
   * Distinguishes one navigation from the next — cross-tab nav reuses the
   * mounted screen, so two taps with identical values need this to differ.
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
 * Everything the Ritual tab needs from route params; `id` changes whenever
 * the link is followed, not just when contents differ. Null with no link.
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
