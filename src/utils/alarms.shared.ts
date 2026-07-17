// Pure alarm scheduling logic, shared by the platform variants of
// `utils/alarms` and unit-tested directly. Native iOS AlarmKit does the
// ringing (see `alarms.ios.ts`); this module only decides *what* should be
// scheduled from the current task list. Keeping it native-free means the
// reconciliation math is testable without mocking the module.

import { Platform } from "react-native";

import { TTask } from "@/api/tasks";
import { isCompletionStatus } from "@/utils/taskFilters";

/** The App Group shared with the AlarmKit dismiss intent (see `app.json`). */
export const ALARM_APP_GROUP = "group.com.dexterplanner";

/**
 * Whether task alarms can actually ring on this platform. AlarmKit is iOS-only,
 * so every alarm-setting surface gates on this rather than repeating a raw
 * `Platform.OS` check and risking one surface diverging from another.
 */
export const isAlarmSupported = Platform.OS === "ios";

/** Seeds a sensible morning time when enabling an alarm that has none yet. */
export const DEFAULT_ALARM_TIME = "09:00";

/** The task fields the alarm layer needs — a narrow slice of `TTask`. */
export type TAlarmTask = Pick<
  TTask,
  "id" | "title" | "alarmTime" | "scheduledFor" | "status"
>;

/** A single alarm to schedule: the task id doubles as the AlarmKit alarm id. */
export type TAlarmSchedule = {
  id: string;
  title: string;
  epochSeconds: number;
};

/**
 * Resolve a task's alarm to the absolute moment it should fire, or `null` when
 * it shouldn't fire at all: no alarm time, no scheduled date to anchor it to,
 * an unparseable value, or a moment already in the past. The alarm lands at the
 * `scheduledFor` date combined with the `alarmTime` time-of-day, in local time.
 */
export const alarmFireDate = (
  task: Pick<TAlarmTask, "alarmTime" | "scheduledFor">,
  now: Date,
): Date | null => {
  if (!task.alarmTime || !task.scheduledFor) return null;

  // `alarmTime` is a Postgres `time` ("HH:MM" or "HH:MM:SS"); only hour+minute
  // matter. `scheduledFor` is a `date` ("YYYY-MM-DD").
  const [hour, minute] = task.alarmTime.split(":").map((p) => parseInt(p, 10));
  const [year, month, day] = task.scheduledFor
    .split("-")
    .map((p) => parseInt(p, 10));

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  const fire = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (fire.getTime() <= now.getTime()) return null;
  return fire;
};

/**
 * Diff the alarms that *should* exist against the ones already scheduled, so the
 * caller schedules only new/changed alarms and cancels stale ones — rather than
 * tearing down and rebuilding every alarm on each task change.
 *
 * @param tasks         current tasks (the DB is the source of truth)
 * @param existingIds   ids AlarmKit currently has scheduled (`getAllAlarms()`)
 * @param scheduledEpochs  fire time (epoch seconds) this session last scheduled
 *                         per id; lets us detect a time edit on an existing alarm
 * @param now           reference time for the past-moment guard
 */
export const reconcileAlarms = (
  tasks: TAlarmTask[],
  existingIds: string[],
  scheduledEpochs: Map<string, number>,
  now: Date,
): { toSchedule: TAlarmSchedule[]; toCancel: string[] } => {
  const desired = new Map<string, TAlarmSchedule>();

  for (const task of tasks) {
    if (isCompletionStatus(task.status)) continue;
    const date = alarmFireDate(task, now);
    if (!date) continue;
    desired.set(task.id, {
      id: task.id,
      title: task.title,
      epochSeconds: Math.floor(date.getTime() / 1000),
    });
  }

  // Schedule anything whose fire time we haven't already scheduled this session
  // (new alarm, or a time edit that changed the epoch).
  const toSchedule = [...desired.values()].filter(
    (alarm) => scheduledEpochs.get(alarm.id) !== alarm.epochSeconds,
  );

  // Cancel anything AlarmKit still holds (or we tracked) that is no longer
  // desired — completed, deleted, unscheduled, or its time now sits in the past.
  const staleIds = new Set([...existingIds, ...scheduledEpochs.keys()]);
  const toCancel = [...staleIds].filter((id) => !desired.has(id));

  return { toSchedule, toCancel };
};
