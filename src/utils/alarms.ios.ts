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
  scheduleTimerAlarm,
} from "expo-alarm-kit";

import {
  ALARM_APP_GROUP,
  TAlarmColors,
  TAlarmSchedule,
  TFocusAlarm,
} from "./alarms.shared";

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
 *
 * `soundName` names a file bundled by the `withAlarmSound` plugin (DEX-72); the
 * key is omitted entirely when absent so AlarmKit stays on its default sound
 * rather than trying to resolve an empty name.
 *
 * `colors` is the reader's current `primary`/`primaryContent` pair, and it is
 * **baked in here rather than tracked**: an `AlarmAttributes` colour is fixed
 * when the alarm is scheduled, and there is no way to repaint an alarm already
 * with AlarmKit short of cancelling and re-scheduling it. Changing theme
 * therefore recolours the alarms set *after* the change and leaves the rest —
 * which is why neither colour appears in `alarmSignature`. Re-scheduling every
 * alarm to restate a colour would run twice a day on its own for anyone on
 * `themeMode: "system"`, where the palette follows the OS scheme.
 *
 * `contentColor` reaches the widget through the alarm's `metadata`, which is
 * why Dexter consumes a fork of `expo-alarm-kit` (DEX-158) — the published
 * module schedules an empty metadata struct, which would leave `tintColor` as
 * the only colour that crosses. Both are always sent: `TAlarmColors` cannot be
 * built without them, so the widget never derives a colour of its own.
 */
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

/**
 * Schedule (or replace) the native countdown for a running focus block
 * (DEX-156), so it rings at zero whether or not the app is open and shows a
 * live countdown on the lock screen and in the Dynamic Island. Cancel-first and
 * throw-on-`false` for the same reasons as `scheduleTaskAlarm` above; the block
 * id doubles as the alarm id.
 *
 * **No `pauseButtonLabel` or `resumeButtonLabel` is passed, and that is the
 * whole design.** Given one, AlarmKit puts a Pause button on the lock screen —
 * and nothing reports back that it was pressed. `AlarmManager.shared.alarms`
 * carries a paused alarm's `state` but never its elapsed time, so the app could
 * only guess at the `remaining_seconds` a lock-screen pause implied, and would
 * guess high by however long it stayed closed. The app owns the anchor; the
 * lock screen shows it. Omitting the labels is what the fork's optional
 * pause/resume buttons are for — the published module builds them
 * unconditionally.
 *
 * `dismissPayload` is written but nothing reads it yet: pressing Stop already
 * lands on the past-due-at-mount rule in `usePublishFocusTimer`, which completes
 * the block on its own. It costs nothing now and is what a second device would
 * need (DEX-155).
 */
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
