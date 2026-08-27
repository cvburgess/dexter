// Base (web + Android) no-op alarm layer; the bundler picks `alarms.ios.ts` on
// iOS. Also lets TypeScript resolve `@/utils/alarms` (no platform extensions).
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
