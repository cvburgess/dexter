import { Temporal } from "@js-temporal/polyfill";
import type { Href } from "expo-router";

import {
  firstParam,
  linkNonce,
  parseDayDate,
  type TRouteParam,
} from "@/utils/routeParams";

/**
 * The Today tab's deep-link contract (DEX-47), builders and parsers in one
 * module so a format change can't update one side and leave the other stale.
 */

/**
 * Mirrors `TDayView` minus `calendar` (nothing links to it), plus `backlog`
 * (the task drawer). No `journal`: it links via `ritualRoute.ts` (DEX-105).
 */
export type TDayMode = "tasks" | "notes" | "backlog";

const DAY_MODES: readonly TDayMode[] = ["tasks", "notes", "backlog"];

/** The requested mode, or null when absent or unrecognized. */
export const parseDayMode = (value: TRouteParam): TDayMode | null => {
  const mode = firstParam(value);
  return DAY_MODES.includes(mode as TDayMode) ? (mode as TDayMode) : null;
};

/**
 * Reads through `firstParam`: a repeated key makes `useLocalSearchParams` hand
 * back a `string[]`, and this value flows into the drawer's search box.
 */
export const parseDayQuery = (value: TRouteParam): string | undefined =>
  firstParam(value);

type TTodayRouteParams = {
  date?: string;
  mode?: TDayMode;
  /** Seeds the task drawer's own search box; only meaningful with `mode: "backlog"`. */
  q?: string;
  /**
   * Distinguishes one navigation from the next: cross-tab navigation only swaps
   * params, and two taps on the same search result produce identical values.
   */
  n?: string;
};

/** The Today tab, optionally pointed at a specific day and surface. */
export const todayRoute = (params: TTodayRouteParams = {}): Href => {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== "",
  );

  return entries.length > 0
    ? { pathname: "/today", params: Object.fromEntries(entries) }
    : "/today";
};

/**
 * `id` changes whenever the link is *followed*, not only when its contents
 * differ; consumers key their "apply once" guards on it.
 */
export type TDayLink = {
  id: string;
  date: Temporal.PlainDate | null;
  mode: TDayMode | null;
  query: string | undefined;
};

type TDayLinkParams = {
  date?: TRouteParam;
  mode?: TRouteParam;
  q?: TRouteParam;
  n?: TRouteParam;
};

export const parseDayLink = (params: TDayLinkParams): TDayLink | null => {
  const date = parseDayDate(params.date);
  const mode = parseDayMode(params.mode);
  const query = parseDayQuery(params.q);

  // Neither a day nor a surface named: nothing to apply, so the tab behaves as
  // if it were pressed normally.
  if (!date && !mode) return null;

  return {
    id: `${linkNonce(params.n)}|${date?.toString() ?? ""}|${mode ?? ""}|${query ?? ""}`,
    date,
    mode,
    query,
  };
};
