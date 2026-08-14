// Base (web + Android) implementation of the widget layer. WidgetKit is
// iOS-only, so both writes are no-ops here; the real App Group calls live in
// `widgets.ios.ts` and the bundler selects that variant on iOS. This base file
// also lets TypeScript resolve `@/utils/widgets` (it does not resolve platform
// extensions).
//
// The payload itself is built on every platform from `widgets.shared.ts` —
// only the side effect differs.
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
