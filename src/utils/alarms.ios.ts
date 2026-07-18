// iOS implementation of the alarm layer, backed by native AlarmKit via
// `expo-alarm-kit` (requires iOS 26+, an App Group, and the
// `NSAlarmKitUsageDescription` Info.plist key — see `app.json`). The bundler
// selects this file over `alarms.ts` on iOS. Pure scheduling math is shared
// from `alarms.shared.ts`.
import {
  cancelAlarm,
  configure,
  getAllAlarms,
  requestAuthorization,
  scheduleAlarm,
} from "expo-alarm-kit";

import { ALARM_APP_GROUP, TAlarmSchedule } from "./alarms.shared";

export * from "./alarms.shared";

let configured = false;

/**
 * Wire up the App Group shared with the alarm dismiss intent. Must run before
 * any other call; safe to call more than once. Invoked once from the root
 * layout.
 */
export const configureAlarms = (): void => {
  if (configured) return;
  configured = configure(ALARM_APP_GROUP);
  if (!configured) {
    console.warn(
      "[alarms] Failed to configure AlarmKit — check the App Group entitlement.",
    );
  }
};

/** Prompt for (or read) alarm permission; `true` only when authorized. */
export const requestAlarmAuthorization = async (): Promise<boolean> => {
  const status = await requestAuthorization();
  return status === "authorized";
};

/**
 * Schedule (or replace) a task's alarm. The task id doubles as the AlarmKit
 * alarm id, so cancelling first makes a time edit replace cleanly rather than
 * leaving a duplicate. `launchAppOnDismiss` brings Dexter forward when the user
 * stops the alarm.
 *
 * `scheduleAlarm` returns `false` (rather than throwing) when AlarmKit rejects
 * the alarm — authorization not granted, the Live Activity can't be presented,
 * etc. We turn that into a throw so callers can't mistake a swallowed native
 * failure for success and leave the user counting on an alarm that won't ring.
 */
export const scheduleTaskAlarm = async (
  alarm: TAlarmSchedule,
): Promise<void> => {
  await cancelAlarm(alarm.id);
  const scheduled = await scheduleAlarm({
    id: alarm.id,
    epochSeconds: alarm.epochSeconds,
    title: alarm.title,
    launchAppOnDismiss: true,
  });
  if (!scheduled) {
    throw new Error(`AlarmKit rejected alarm ${alarm.id}`);
  }
};

/** Cancel a task's alarm in AlarmKit and shared storage. */
export const cancelTaskAlarm = async (id: string): Promise<void> => {
  await cancelAlarm(id);
};

/** Ids AlarmKit currently has scheduled (persists across app launches). */
export const getScheduledAlarmIds = (): string[] => getAllAlarms();
