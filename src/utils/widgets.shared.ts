// What the iOS widget extension may know, and the pure builder (DEX-83). The
// widget never fetches: a second refresh-token holder would revoke the session.

import { Temporal } from "@js-temporal/polyfill";

import { TDailyHabit, THabit } from "@/api/habits";
import { TTask } from "@/api/tasks";
import { selectOpenTasksForDate } from "@/utils/taskFilters";
import { TThemeColors } from "@/utils/theme";

/** The App Group key the snapshot is written under, read by `DexterWidgetSnapshot.load()`. */
export const WIDGET_SNAPSHOT_KEY = "todaySnapshot";

/** The habits payload's own key (DEX-160) — reloads are metered per widget
 * kind, so one shared blob would spend both widgets' budgets on every edit. */
export const HABIT_SNAPSHOT_KEY = "habitsSnapshot";

/** Steps `DexterHabitStepIntent` couldn't persist (DEX-160). Only the extension
 * writes it, only the app clears it — a republish can't revert an undrained tap. */
export const PENDING_HABIT_STEPS_KEY = "pendingHabitSteps";

/** The XL iPad widget's four columns — and what makes midnight rollover free:
 * each midnight timeline entry re-slices this same payload to the new day. */
export const WIDGET_DAY_COUNT = 4;

/** Sized to the tallest (382pt) family; `dexterRowLimit` in
 * `DexterTasksWidget.swift` relies on this bound rather than restating one. */
export const WIDGET_TASKS_PER_DAY = 14;

/** The medium widget's whole 4×2 grid; the small 2×2 draws the first four.
 * Extras drop silently (DEX-160) — a ring can't say "and three more". */
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
  /** Every open task on the day, not just the ones that fit in `tasks` — the
   * header count would otherwise quietly become "up to twelve". */
  openCount: number;
  tasks: TWidgetTask[];
};

/** Subset of `TThemeColors` the widget draws with. `textSecondary` stays out —
 * Swift parses `#rrggbb` only; `primaryContent` is for the habit check (DEX-160). */
export type TWidgetPalette = {
  background: string;
  border: string;
  text: string;
  primary: string;
  primaryContent: string;
  priority: string[];
};

/** Both palettes travel — the extension can't read `preferences.theme_mode`, so
 * it picks by `colorScheme`; a forced mode sends the same palette in both halves. */
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

/** Open tasks only, via `selectOpenTasksForDate`, so "still open" stays one
 * decision; the filter keeps the canonical order, so the widget matches Today. */
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

/** DEX-160: built from `habits`, progress overlaid from any matching daily row
 * (rows may not exist yet). Sorted by id to match `getDailyHabits`' order. */
export const buildHabitWidgetSnapshot = (
  habits: THabit[],
  dailyHabits: TDailyHabit[],
  today: Temporal.PlainDate,
  palettes: { light: TThemeColors; dark: TThemeColors },
): TWidgetHabitSnapshot => ({
  days: Array.from({ length: WIDGET_DAY_COUNT }, (_unused, offset) => {
    const date = today.add({ days: offset });

    // `HabitTracker`'s three conditions in one place: a habit edit doesn't
    // invalidate the `dailyHabits` cache, so a dead ring could survive out here.
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
          // The row's own `steps` when one exists: the trigger syncs the two on
          // a same-day edit, keeping the ring in step with the app's fraction.
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

/** Keyed by date *and* habit — the payload carries four days, so a 23:59 tap
 * must land on the day the widget showed. Swift restates the `|`; see there. */
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

/** Total and per-entry, never throwing: the payload was written by a different
 * binary. Dropping one bad entry costs a tap; rejecting all costs every tap. */
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
