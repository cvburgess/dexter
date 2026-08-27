// iOS alarm layer on native AlarmKit via `expo-alarm-kit` (iOS 26+, App Group,
// `NSAlarmKitUsageDescription` — see `app.json`). Pure math: `alarms.shared.ts`.
import {
  cancelAlarm,
  configure,
  getAllAlarms,
  requestAuthorization,
  scheduleAlarm,
  scheduleTimerAlarm,
} from "expo-alarm-kit";

import { APP_GROUP } from "@/utils/appGroup";

import { TAlarmColors, TAlarmSchedule, TFocusAlarm } from "./alarms.shared";

export * from "./alarms.shared";

let configured = false;

/** Wire up the App Group shared with the dismiss intent. Must run before any
 * other call; safe to repeat. Invoked once from the root layout. */
export const configureAlarms = (): void => {
  if (configured) return;
  configured = configure(APP_GROUP);
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

/** `colors` is baked in, not tracked — AlarmKit can't repaint a scheduled alarm,
 * so `alarmSignature` omits both; `contentColor` needs the DEX-158 fork (DEX-72). */
export const scheduleTaskAlarm = async (
  alarm: TAlarmSchedule,
  colors: TAlarmColors,
): Promise<void> => {
  await cancelAlarm(alarm.id);
  const scheduled = await scheduleAlarm({
    id: alarm.id,
    epochSeconds: alarm.epochSeconds,
    title: alarm.title,
    launchAppOnDismiss: true,
    tintColor: colors.tint,
    contentColor: colors.content,
    ...(alarm.soundName ? { soundName: alarm.soundName } : {}),
  });
  if (!scheduled) {
    throw new Error(`AlarmKit rejected alarm ${alarm.id}`);
  }
};

/** Focus-block countdown (DEX-156). No pause/resume labels on purpose: AlarmKit
 * never reports a lock-screen pause's elapsed time. `dismissPayload`: DEX-155. */
export const scheduleFocusAlarm = async (
  alarm: TFocusAlarm,
  colors: TAlarmColors,
): Promise<void> => {
  await cancelAlarm(alarm.id);
  const scheduled = await scheduleTimerAlarm({
    id: alarm.id,
    duration: alarm.durationSeconds,
    title: alarm.title,
    launchAppOnDismiss: true,
    dismissPayload: alarm.id,
    tintColor: colors.tint,
    contentColor: colors.content,
    ...(alarm.soundName ? { soundName: alarm.soundName } : {}),
  });
  if (!scheduled) {
    throw new Error(`AlarmKit rejected focus alarm ${alarm.id}`);
  }
};

/** Cancel a task's alarm in AlarmKit and shared storage. */
export const cancelTaskAlarm = async (id: string): Promise<void> => {
  await cancelAlarm(id);
};

/** Ids AlarmKit currently has scheduled (persists across app launches). */
export const getScheduledAlarmIds = (): string[] => getAllAlarms();
