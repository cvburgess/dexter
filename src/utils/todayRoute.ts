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
 * Where tapping a search result should land.
 *
 * A task with no scheduled date has no day to open, so it goes to the backlog
 * with the query carried along — the drawer seeds its own search box from it, so
 * the task is on screen immediately instead of somewhere in the backlog.
 */
export const searchResultRoute = (
  result: TSearchResult,
  query: string,
): Href => {
  if (result.kind === "task") {
    return result.task.scheduledFor
      ? todayRoute({ date: result.task.scheduledFor, mode: "tasks" })
      : todayRoute({ mode: "backlog", q: query });
  }

  return todayRoute({
    date: result.date,
    mode: result.kind === "note" ? "notes" : "journal",
  });
};
