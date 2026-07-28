import { Temporal } from "@js-temporal/polyfill";
import type { Href } from "expo-router";

import { TSearchResult } from "@/api/search";

/**
 * The Today tab's deep-link contract (DEX-47), both directions: the builders
 * below construct `/today?date=&mode=&q=`, and the parsers read it back in
 * `today/index.tsx`. Kept in one module so a change to the link format can't
 * update one side and leave the other reading the old shape — the same reason
 * `utils/newTaskRoute.ts` owns the create-task route on its own.
 */

/**
 * Which surface of the day to land on. The first three mirror `TDayView` (minus
 * `calendar`, which nothing links to — there is nothing in a calendar event to
 * search). `backlog` is not a day view at all: it opens the task drawer, which
 * is a sheet on small screens and a docked pane on large ones, and is where an
 * unscheduled task lives.
 */
export type TDayMode = "tasks" | "notes" | "journal" | "backlog";

const DAY_MODES: readonly TDayMode[] = ["tasks", "notes", "journal", "backlog"];

/** A route param, which arrives as a string, an array, or not at all. */
type TRouteParam = string | string[] | undefined;

/** Route params are `string[]` when a key is repeated in the URL; take the first. */
const firstParam = (value: TRouteParam): string | undefined =>
  Array.isArray(value) ? value[0] : value;

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

/**
 * The requested day, or null when absent or unparseable.
 *
 * A hand-edited or stale URL is a real source of garbage here (the route is
 * linkable on web), and `Temporal.PlainDate.from` throws on both a malformed
 * string and an impossible date like `2026-02-30` — so a bad param falls back to
 * today rather than crashing the tab.
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

  // `n` is absent from a hand-written or bookmarked URL, in which case the id
  // is derived purely from the contents and the link applies exactly once —
  // which is the right behavior for a link that was typed rather than tapped.
  const nonce = firstParam(params.n) ?? "";
  return {
    id: `${nonce}|${date?.toString() ?? ""}|${mode ?? ""}|${query ?? ""}`,
    date,
    mode,
    query,
  };
};

/**
 * Where tapping a search result should land.
 *
 * A task with no scheduled date has no day to open, so it goes to the backlog
 * with the query carried along — the drawer seeds its own search box from it, so
 * the task is on screen immediately instead of somewhere in the backlog.
 *
 * `nonce` should differ per tap; see `TTodayRouteParams["n"]`.
 */
export const searchResultRoute = (
  result: TSearchResult,
  query: string,
  nonce: string,
): Href => {
  if (result.kind === "task") {
    return result.task.scheduledFor
      ? todayRoute({ date: result.task.scheduledFor, mode: "tasks", n: nonce })
      : todayRoute({ mode: "backlog", q: query, n: nonce });
  }

  return todayRoute({
    date: result.date,
    mode: result.kind === "note" ? "notes" : "journal",
    n: nonce,
  });
};
