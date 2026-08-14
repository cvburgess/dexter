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

import { TDailyHabit, THabit } from "@/api/habits";
import { TTask } from "@/api/tasks";
import { selectOpenTasksForDate } from "@/utils/taskFilters";
import { TThemeColors } from "@/utils/theme";

/** The App Group key the snapshot is written under, read by `DexterWidgetSnapshot.load()`. */
export const WIDGET_SNAPSHOT_KEY = "todaySnapshot";

/**
 * The habits payload's own key, read by `DexterHabitWidgetSnapshot.load()`
 * (DEX-160).
 *
 * A second key rather than another field on `TWidgetSnapshot`, because a reload
 * is metered per widget kind: one shared blob would make every task edit spend
 * the habits widget's daily budget and every habit tap spend the task widget's.
 * The two palettes ride along twice, which is fourteen short strings — cheaper
 * than the reloads it saves.
 */
export const HABIT_SNAPSHOT_KEY = "habitsSnapshot";

/**
 * Where `DexterHabitStepIntent` parks the steps it could not persist itself
 * (DEX-160). A `Record<string, number>` of `pendingHabitStepsKey()` to the new
 * absolute `stepsComplete`, serialized as JSON.
 *
 * **Only the extension writes it, and only the app clears it.** That one-way
 * ownership is the point: the widget renders `pending ?? snapshot`, so a
 * republish the app makes for an unrelated reason — a task edited on the phone,
 * a theme change — cannot revert a tap that has not been drained yet.
 */
export const PENDING_HABIT_STEPS_KEY = "pendingHabitSteps";

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
 * How many tasks per day travel in the payload.
 *
 * Sized to the tallest family rather than picked round: a large widget is 382pt
 * high, which after content margins, the header, and a ~22pt row leaves room for
 * about fourteen — so this is what keeps the payload from being the thing that
 * runs out before the widget does (`dexterRowLimit` in `DexterTasksWidget.swift`
 * relies on that, drawing whatever arrives on large and extra-large rather than
 * restating a number that would have to be kept in step with this one). It
 * exists to bound the payload, and with it the churn that decides whether we
 * spend a widget reload. A day busier than this still reports its true total in
 * the header.
 */
export const WIDGET_TASKS_PER_DAY = 14;

/**
 * How many habits per day travel in the payload.
 *
 * Eight is the medium widget's whole 4×2 grid, and the small widget's 2×2 draws
 * the first four of the same array — so this is the cap for both families and
 * the point past which extra habits are dropped silently (DEX-160). No count
 * accompanies them the way `openCount` accompanies tasks: a habit row is a set
 * of rings, and "and three more" is not something a ring can say.
 */
export const WIDGET_HABITS_PER_DAY = 8;

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
 *
 * `primaryContent` earns its place only because a completed habit ring fills
 * solid `primary` and stamps a checkmark on top of it (DEX-160) — the one mark
 * in any widget drawn *over* the accent rather than beside it.
 */
export type TWidgetPalette = {
  background: string;
  border: string;
  text: string;
  primary: string;
  primaryContent: string;
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
  primaryContent: colors.primaryContent,
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

export type TWidgetHabit = {
  id: string;
  emoji: string;
  /** Only the accessibility label reads it; the ring itself draws the emoji. */
  title: string;
  /** The day's target. `steps === stepsComplete` is a finished ring. */
  steps: number;
  stepsComplete: number;
};

export type TWidgetHabitDay = {
  /** ISO `YYYY-MM-DD`; the widget matches its own local day against this. */
  date: string;
  habits: TWidgetHabit[];
};

/** The habits counterpart of `TWidgetSnapshot`, under `HABIT_SNAPSHOT_KEY`. */
export type TWidgetHabitSnapshot = {
  days: TWidgetHabitDay[];
  light: TWidgetPalette;
  dark: TWidgetPalette;
};

/**
 * Today plus the next three days of habit rings (DEX-160).
 *
 * **Every day is built from `habits`, not from `dailyHabits`** — today included,
 * with its progress overlaid from the matching daily row where one exists. The
 * rows are bootstrapped by an effect in `HabitTracker`, so a user who has not
 * opened the Today tab yet has none at all; driving the widget off them would
 * leave the home screen empty until the app happened to run, on exactly the
 * mornings a habit widget is most worth having. Building from `habits` means
 * the rings are right first, and `useHabitWidgetDrain` creates whatever row a
 * tap turns out to need.
 *
 * The same substitution is what makes the future days free: they have no rows
 * and never will until they arrive, so they are the general case rather than a
 * branch — `stepsComplete` is simply 0 for a date no row matches.
 *
 * Sorted by `id` to match `getDailyHabits`' `.order("habit_id")`, so the widget
 * lists rings in the same order as the Today row above them. (`HabitTracker`'s
 * *future* columns on the Week tab sort by title instead — a pre-existing
 * inconsistency in the app that this does not try to settle.)
 */
export const buildHabitWidgetSnapshot = (
  habits: THabit[],
  dailyHabits: TDailyHabit[],
  today: Temporal.PlainDate,
  palettes: { light: TThemeColors; dark: TThemeColors },
): TWidgetHabitSnapshot => ({
  days: Array.from({ length: WIDGET_DAY_COUNT }, (_unused, offset) => {
    const date = today.add({ days: offset });

    // The same three conditions `HabitTracker` applies, in one place: the DB
    // trigger already drops today's row on pause/archive, but a habit edit does
    // not invalidate the `dailyHabits` cache, so a ring the app has stopped
    // drawing could otherwise survive on the home screen.
    const active = habits
      .filter(
        (habit) =>
          !habit.isPaused &&
          !habit.isArchived &&
          habit.daysActive.includes(date.dayOfWeek),
      )
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      date: date.toString(),
      habits: active.slice(0, WIDGET_HABITS_PER_DAY).map((habit) => {
        const row = dailyHabits.find(
          (dailyHabit) =>
            dailyHabit.habitId === habit.id &&
            dailyHabit.date === date.toString(),
        );

        return {
          id: habit.id,
          emoji: habit.emoji,
          title: habit.title,
          // The row's own `steps`, not the habit's, whenever one exists: the
          // trigger syncs the two on a same-day edit, and trusting the row
          // keeps the ring in step with the fraction the app is showing.
          steps: row?.steps ?? habit.steps,
          stepsComplete: row?.stepsComplete ?? 0,
        };
      }),
    };
  }),
  light: toWidgetPalette(palettes.light),
  dark: toWidgetPalette(palettes.dark),
});

/** The queue `DexterHabitStepIntent` writes: key → new absolute `stepsComplete`. */
export type TPendingHabitSteps = Record<string, number>;

/**
 * The composite key a pending step is filed under.
 *
 * Keyed by date *and* habit, because the payload carries four days: a tap made
 * at 23:59 has to land on the day the widget was showing when it was tapped,
 * not on whichever day the app happens to be looking at when it drains. Stated
 * here rather than in both `DexterPendingHabitSteps.swift` and the drain hook,
 * though Swift necessarily restates the `|` — see the note there.
 */
export const pendingHabitStepsKey = (date: string, habitId: string): string =>
  `${date}|${habitId}`;

/** The inverse of `pendingHabitStepsKey`, or null for a key this build cannot read. */
export const parsePendingHabitStepsKey = (
  key: string,
): { date: string; habitId: string } | null => {
  const [date, habitId, ...rest] = key.split("|");
  if (!date || !habitId || rest.length > 0) return null;
  return { date, habitId };
};

/**
 * The queue as the app sees it, from whatever string the App Group held.
 *
 * Total rather than throwing, and per-entry rather than all-or-nothing: this
 * parses a payload written by a *different binary* — the extension's — which a
 * partial upgrade or a half-finished write can leave malformed. Dropping one
 * unreadable entry costs a single tap; rejecting the object costs every tap the
 * user has made since the app was last open.
 */
export const parsePendingHabitSteps = (
  raw: string | null,
): TPendingHabitSteps => {
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  return Object.entries(parsed).reduce<TPendingHabitSteps>(
    (pending, [key, value]) => {
      if (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        parsePendingHabitStepsKey(key)
      ) {
        pending[key] = value;
      }
      return pending;
    },
    {},
  );
};
