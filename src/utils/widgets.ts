// Base (web + Android) no-op widget layer; the bundler picks `widgets.ios.ts`
// on iOS. Also lets TypeScript resolve `@/utils/widgets` (no platform extensions).
import {
  TPendingHabitSteps,
  TWidgetHabitSnapshot,
  TWidgetSnapshot,
} from "./widgets.shared";

export * from "./widgets.shared";

/** No-op off iOS. */
export const writeWidgetSnapshot = (_snapshot: TWidgetSnapshot): void => {};

/** No-op off iOS. */
export const clearWidgetSnapshot = (): void => {};

/** No-op off iOS. */
export const writeHabitWidgetSnapshot = (
  _snapshot: TWidgetHabitSnapshot,
): void => {};

/** No-op off iOS. */
export const clearHabitWidgetSnapshot = (): void => {};

/** Always empty off iOS: nothing can queue a step where there is no widget. */
export const readPendingHabitSteps = (): TPendingHabitSteps => ({});

/** No-op off iOS. */
export const clearPendingHabitSteps = (_keys: string[]): void => {};
