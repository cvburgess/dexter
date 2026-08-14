// What the iOS widget extension is allowed to know, and the pure function that
// derives it (DEX-83). Native-free so it unit-tests directly — the same split
// `alarms.shared.ts` / `alarms.ios.ts` uses, and for the same reason.
//
// **The widget renders a snapshot; it never fetches.** The Supabase session
// lives in AsyncStorage inside the app container, which an extension cannot
// read, and mirroring it into the App Group would put a second refresh-token
// holder on the session: Supabase rotates refresh tokens with a 10-second reuse
// interval, and a widget refreshing on its own schedule leaves the app's stored
// token generations behind, at which point the whole session is revoked and the
// user is signed out. Snapshotting also keeps `canonicalTaskFilters` in one
// place rather than restating it in Swift.

import { Temporal } from "@js-temporal/polyfill";

import { TTask } from "@/api/tasks";
import { selectOpenTasksForDate } from "@/utils/taskFilters";
import { TThemeColors } from "@/utils/theme";

/** The App Group key the snapshot is written under, read by `DexterWidgetSnapshot.load()`. */
export const WIDGET_SNAPSHOT_KEY = "todaySnapshot";

/**
 * Today plus the next three days.
 *
 * Four is what the extra-large iPad widget shows as columns, and carrying four
 * is also what makes a midnight rollover free: the timeline emits an entry per
 * upcoming midnight and each one re-slices this same payload to the new day, so
 * a snapshot written tonight is still correct on the home screen tomorrow
 * morning with no network, no background task, and no midnight timer in JS.
 * Past the fourth day the widget finds no entry for today and falls back to its
 * "Open Dexter" state rather than showing a stale day as if it were current.
 */
export const WIDGET_DAY_COUNT = 4;

/**
 * How many tasks per day travel in the payload. Comfortably more than the
 * largest family renders (the extra-large columns are the greediest), so this
 * never truncates something a widget would have drawn — it exists to bound the
 * payload, and with it the churn that decides whether we spend a widget reload.
 */
export const WIDGET_TASKS_PER_DAY = 12;

export type TWidgetTask = {
  id: string;
  title: string;
  /** The raw `ETaskPriority` index — Swift uses it to pick out of `priority`. */
  priority: number;
};

export type TWidgetDay = {
  /** ISO `YYYY-MM-DD`; the widget matches its own local day against this. */
  date: string;
  /**
   * Every open task on the day, not just the ones that fit in `tasks`. The
   * header count would otherwise quietly become "up to twelve".
   */
  openCount: number;
  tasks: TWidgetTask[];
};

/**
 * The subset of `TThemeColors` the widget draws with.
 *
 * `textSecondary` is left out because it is an `rgba()` string and the Swift
 * side parses `#rrggbb` only — SwiftUI derives the dimmed ink with
 * `.opacity()` instead. `priorityMuted` is left out because it is blended at
 * module load and nothing in these layouts fills a row behind a task.
 */
export type TWidgetPalette = {
  background: string;
  border: string;
  text: string;
  primary: string;
  priority: string[];
};

/**
 * Both palettes travel, because the extension cannot read
 * `preferences.theme_mode` and so cannot resolve the active one itself — it
 * picks with `@Environment(\.colorScheme)`. The caller resolves each half
 * through `resolveTheme`, so a user who has *forced* light or dark gets that
 * same palette in both halves and the widget correctly stops following the OS.
 */
export type TWidgetSnapshot = {
  days: TWidgetDay[];
  light: TWidgetPalette;
  dark: TWidgetPalette;
};

const toWidgetPalette = (colors: TThemeColors): TWidgetPalette => ({
  background: colors.background,
  border: colors.border,
  text: colors.text,
  primary: colors.primary,
  priority: colors.priority,
});

/**
 * Everything the widget extension needs, derived from the same cached task
 * array every screen reads.
 *
 * Open tasks only, through `selectOpenTasksForDate` — so "still open" stays the
 * one decision `utils/taskStatus`'s `isCompletionStatus` makes, and a status
 * added there is closed-out here for free. It is also what gives the widget its
 * empty state: a day with no open tasks is "All done!", which would be
 * unreachable if closed-out rows kept the list non-empty.
 *
 * Order is the canonical fetch's own (`status`, then `priority`, then `due_on`)
 * — `selectOpenTasksForDate` filters without reordering, so the widget lists
 * tasks exactly as the Today screen does and needs no sort of its own.
 */
export const buildWidgetSnapshot = (
  tasks: TTask[],
  today: Temporal.PlainDate,
  palettes: { light: TThemeColors; dark: TThemeColors },
): TWidgetSnapshot => ({
  days: Array.from({ length: WIDGET_DAY_COUNT }, (_unused, offset) => {
    const date = today.add({ days: offset });
    const open = selectOpenTasksForDate(tasks, date);

    return {
      date: date.toString(),
      openCount: open.length,
      tasks: open.slice(0, WIDGET_TASKS_PER_DAY).map((task) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
      })),
    };
  }),
  light: toWidgetPalette(palettes.light),
  dark: toWidgetPalette(palettes.dark),
});
