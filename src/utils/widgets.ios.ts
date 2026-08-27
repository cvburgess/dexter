// iOS widget layer: writes the snapshot to the App Group's UserDefaults, then
// asks WidgetKit to redraw (DEX-83). ExtensionStorage needs no new native module.
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

/** The `kind` each Swift Widget declares. Reloads are metered per kind (DEX-160)
 * so writes name their widget; `DexterAddTaskWidget` reads nothing — absent. */
const TASKS_WIDGET_KIND = "DexterTasksWidget";
const HABITS_WIDGET_KIND = "DexterHabitsWidget";

/** One JSON string, not `ExtensionStorage`'s object overloads — those flatten
 * to `Record<string, string | number>` and cannot express the nested days. */
export const writeWidgetSnapshot = (snapshot: TWidgetSnapshot): void => {
  storage.set(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  ExtensionStorage.reloadWidget(TASKS_WIDGET_KIND);
};

/** What a sign-out calls, so the next user's home screen isn't showing the last
 * one's tasks; the widget's own empty state covers the gap. */
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

/** Drops the habits payload *and* the undrained tap queue — after a sign-out
 * there is no session left to own those steps. */
export const clearHabitWidgetSnapshot = (): void => {
  storage.remove(HABIT_SNAPSHOT_KEY);
  storage.remove(PENDING_HABIT_STEPS_KEY);
  ExtensionStorage.reloadWidget(HABITS_WIDGET_KIND);
};

/** Whatever `DexterHabitStepIntent` has queued since the app last drained. */
export const readPendingHabitSteps = (): TPendingHabitSteps =>
  parsePendingHabitSteps(storage.get(PENDING_HABIT_STEPS_KEY));

/** Re-read and subtract rather than blanket-remove: `UserDefaults` has no
 * compare-and-swap, so this narrows (not closes) the eaten-in-flight-tap window. */
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
