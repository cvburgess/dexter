import { Temporal } from "@js-temporal/polyfill";
import type { Href } from "expo-router";

import {
  firstParam,
  linkNonce,
  parseDayDate,
  type TRouteParam,
} from "@/utils/routeParams";

/**
 * The Today tab's deep-link contract (DEX-47), both directions: the builders
 * below construct `/today?date=&mode=&q=`, and the parsers read it back in
 * `today/index.tsx`. Kept in one module so a change to the link format can't
 * update one side and leave the other reading the old shape — the same reason
 * `utils/newTaskRoute.ts` owns the create-task route on its own. Where a search
 * result *goes* is `utils/searchRoute.ts`' business now that a result can land
 * on another tab entirely.
 */

/**
 * Which surface of the day to land on. The first two mirror `TDayView` (minus
 * `calendar`, which nothing links to — there is nothing in a calendar event to
 * search). `backlog` is not a day view at all: it opens the task drawer, which
 * is a sheet on small screens and a docked pane on large ones, and is where an
 * unscheduled task lives. There is no `journal`: the journal moved to the
 * Ritual tab (DEX-105), so a journal result links through
 * `utils/ritualRoute.ts` instead.
 */
export type TDayMode = "tasks" | "notes" | "backlog";

const DAY_MODES: readonly TDayMode[] = ["tasks", "notes", "backlog"];

/** The requested mode, or null when absent or unrecognized. */
export const parseDayMode = (value: TRouteParam): TDayMode | null => {
  const mode = firstParam(value);
  return DAY_MODES.includes(mode as TDayMode) ? (mode as TDayMode) : null;
};

/**
 * The query carried by a `mode=backlog` link, or undefined when absent.
 *
 * Goes through `firstParam` like the others rather than being read raw: a
 * repeated key makes `useLocalSearchParams` hand back a `string[]`, and this one
 * flows furthest — into the drawer's search box — so typing it as a bare string
 * would be the one hole in this module's boundary.
 */
export const parseDayQuery = (value: TRouteParam): string | undefined =>
  firstParam(value);

type TTodayRouteParams = {
  date?: string;
  mode?: TDayMode;
  /** Seeds the task drawer's own search box; only meaningful with `mode: "backlog"`. */
  q?: string;
  /**
   * Distinguishes one navigation from the next.
   *
   * Cross-tab navigation reuses the mounted Today screen and only swaps its
   * params, so the screen can only tell "this link changed" by comparing values
   * — and two taps on the same search result produce identical values. Without
   * something to separate them, tapping a result, navigating to another day, and
   * tapping the same result again switches tabs and then does nothing.
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
 * Everything the Today tab needs from its route params, with an `id` that
 * changes whenever the link is *followed* rather than only when its contents
 * differ. Null when the route carries no link at all (an ordinary tab press).
 *
 * Consumers key their "apply once" guards on `id`, which is what makes
 * re-following the same link work.
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
