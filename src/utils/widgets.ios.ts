// iOS implementation of the widget layer: hands the snapshot to the App Group
// the widget extension reads, then asks WidgetKit to redraw (DEX-83). The
// bundler selects this file over `widgets.ts` on iOS.
//
// `ExtensionStorage` ships with `@bacons/apple-targets` — the same package that
// already generates `targets/DexterAlarmWidget` — so this needs no new native
// module. It writes into the group's `UserDefaults`, which is exactly what
// `UserDefaults(suiteName:)` reads back in Swift.
import { ExtensionStorage } from "@bacons/apple-targets";

import { APP_GROUP } from "@/utils/appGroup";

import {
  HABIT_SNAPSHOT_KEY,
  parsePendingHabitSteps,
  PENDING_HABIT_STEPS_KEY,
  TPendingHabitSteps,
  TWidgetHabitSnapshot,
  TWidgetSnapshot,
  WIDGET_SNAPSHOT_KEY,
} from "./widgets.shared";

export * from "./widgets.shared";

const storage = new ExtensionStorage(APP_GROUP);

/**
 * The `kind` each `Widget` declares in Swift, so a write can redraw only what it
 * changed.
 *
 * `reloadWidget(name)` maps to `WidgetCenter.shared.reloadTimelines(ofKind:)`
 * and the bare call to `reloadAllTimelines()`. Since DEX-160 there are two
 * independent payloads, and reloads are metered per kind at roughly 40-70 a
 * day — so an unnamed reload would have every task edit spend the habits
 * widget's budget and every habit tap spend the task widget's.
 * `DexterAddTaskWidget` is deliberately absent: it reads nothing and its
 * timeline policy is `.never`, so a reload has nothing to tell it.
 */
const TASKS_WIDGET_KIND = "DexterTasksWidget";
const HABITS_WIDGET_KIND = "DexterHabitsWidget";

/**
 * Stored as one JSON string rather than through `ExtensionStorage`'s object and
 * array overloads: those flatten to `Record<string, string | number>`, which
 * cannot express a day holding a list of tasks. A string round-trips through
 * `JSONDecoder` on the other side with the nesting intact, and the payload is
 * camelCase on both sides so no key strategy is needed.
 */
export const writeWidgetSnapshot = (snapshot: TWidgetSnapshot): void => {
  storage.set(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  ExtensionStorage.reloadWidget(TASKS_WIDGET_KIND);
};

/**
 * Drops the snapshot and redraws — what a sign-out calls, so the next user's
 * home screen isn't still showing the last one's tasks. The widget's own empty
 * state covers the gap.
 */
export const clearWidgetSnapshot = (): void => {
  storage.remove(WIDGET_SNAPSHOT_KEY);
  ExtensionStorage.reloadWidget(TASKS_WIDGET_KIND);
};

/** The habits payload, on its own key and its own reload (DEX-160). */
export const writeHabitWidgetSnapshot = (
  snapshot: TWidgetHabitSnapshot,
): void => {
  storage.set(HABIT_SNAPSHOT_KEY, JSON.stringify(snapshot));
  ExtensionStorage.reloadWidget(HABITS_WIDGET_KIND);
};

/**
 * Drops the habits payload *and the queue of taps that had not reached Supabase
 * yet* — a sign-out is the one moment those steps stop being worth keeping,
 * since there is no longer a session that could own them.
 */
export const clearHabitWidgetSnapshot = (): void => {
  storage.remove(HABIT_SNAPSHOT_KEY);
  storage.remove(PENDING_HABIT_STEPS_KEY);
  ExtensionStorage.reloadWidget(HABITS_WIDGET_KIND);
};

/** Whatever `DexterHabitStepIntent` has queued since the app last drained. */
export const readPendingHabitSteps = (): TPendingHabitSteps =>
  parsePendingHabitSteps(storage.get(PENDING_HABIT_STEPS_KEY));

/**
 * Removes exactly the keys that were persisted, leaving any that arrived while
 * the drain was in flight.
 *
 * A blanket `remove` would be simpler and would silently eat a tap made during
 * the round-trip to Supabase. Re-reading and subtracting narrows that window to
 * the moment between this read and this write — `UserDefaults` offers no
 * compare-and-swap, so it cannot be closed, only made small enough that losing
 * a tap needs the user to hit the widget in the same instant the app foregrounds.
 *
 * No reload: the widget renders `pending ?? snapshot`, and the republish that
 * follows a drain carries the same numbers the pending entries did.
 */
export const clearPendingHabitSteps = (keys: string[]): void => {
  if (keys.length === 0) return;

  const remaining = Object.entries(readPendingHabitSteps()).filter(
    ([key]) => !keys.includes(key),
  );

  if (remaining.length === 0) {
    storage.remove(PENDING_HABIT_STEPS_KEY);
    return;
  }

  storage.set(
    PENDING_HABIT_STEPS_KEY,
    JSON.stringify(Object.fromEntries(remaining)),
  );
};
