// Base (web + Android) implementation of the alarm layer. AlarmKit is iOS-only,
// so everything here is a no-op; the real native calls live in `alarms.ios.ts`
// and the bundler selects that variant on iOS. This base file also lets
// TypeScript resolve `@/utils/alarms` (it does not resolve platform extensions).
//
// The pure reconciliation math is shared from `alarms.shared.ts` on every
// platform — only the native side effects differ.
import { TAlarmColors, TAlarmSchedule, TFocusAlarm } from "./alarms.shared";

export * from "./alarms.shared";

/** No-op off iOS. */
export const configureAlarms = (): void => {};

/** Alarms can't ring off iOS, so authorization is never granted. */
export const requestAlarmAuthorization = (): Promise<boolean> =>
  Promise.resolve(false);

export const scheduleTaskAlarm = async (
  _alarm: TAlarmSchedule,
  _colors: TAlarmColors,
): Promise<void> => {};

export const scheduleFocusAlarm = async (
  _alarm: TFocusAlarm,
  _colors: TAlarmColors,
): Promise<void> => {};

export const cancelTaskAlarm = async (_id: string): Promise<void> => {};

export const getScheduledAlarmIds = (): string[] => [];
