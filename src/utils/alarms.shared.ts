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

/** Seeds a sensible morning time for a repeat template's alarm (recurring, so
 * "now" is meaningless — every generated occurrence is a future date). One-off
 * task alarms use {@link defaultAlarmTime} instead. */
export const DEFAULT_ALARM_TIME = "09:00";

/** How far ahead of "now" a freshly-enabled one-off alarm is seeded, so
 * accepting the default never lands in the past (which would silently never
 * ring). */
export const DEFAULT_ALARM_LEAD_MINUTES = 5;

/** A selectable alarm sound (see {@link ALARM_SOUNDS}). */
export type TAlarmSound = "system" | "echos";

/** What a fresh account rings with — Dexter's own sound, not iOS's (DEX-72). */
export const DEFAULT_ALARM_SOUND: TAlarmSound = "echos";

/**
 * The alarm sounds a user can pick from in Settings → Tasks. `fileName` is the
 * bundled resource AlarmKit rings (omit it to leave AlarmKit on its default
 * sound). Adding a sound means adding an entry here *and* the audio file to
 * the `withAlarmSound` plugin's `sounds` list in `app.json` — a name AlarmKit
 * can't resolve in the bundle rings nothing.
 */
export const ALARM_SOUNDS: readonly {
  value: TAlarmSound;
  label: string;
  fileName?: string;
}[] = [
  { value: "system", label: "System" },
  { value: "echos", label: "Echos", fileName: "echos.wav" },
];

/**
 * The stored preference, if this build ships it. A newer client (or a
 * hand-edited row) can name a sound this build doesn't bundle, and every
 * consumer degrades the same way: to the system sound, rather than showing an
 * empty picker or naming a file that would ring silently.
 */
const knownAlarmSound = (sound: string) =>
  ALARM_SOUNDS.find((option) => option.value === sound);

/** A stored preference narrowed to a sound this build offers. */
export const resolveAlarmSound = (sound: string): TAlarmSound =>
  knownAlarmSound(sound)?.value ?? "system";

/** The bundled filename to hand AlarmKit, or `undefined` for its own default. */
export const alarmSoundFileName = (sound: string): string | undefined =>
  knownAlarmSound(sound)?.fileName;

/** Format a `Date`'s local time-of-day as `"HH:MM"`. */
const toTimeString = (date: Date): string =>
  `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

/**
 * Local time-of-day right now (`"HH:MM"`) — the earliest an alarm scheduled for
 * *today* may fire, so it doubles as the time picker's lower bound on the
 * current day.
 */
export const currentAlarmTime = (now: Date = new Date()): string =>
  toTimeString(now);

/**
 * A sensible default when enabling an alarm on a one-off task: a few minutes
 * from `now` (see {@link DEFAULT_ALARM_LEAD_MINUTES}), so tapping "Set alarm"
 * and accepting the default lands just ahead rather than in the past.
 */
export const defaultAlarmTime = (now: Date = new Date()): string =>
  toTimeString(new Date(now.getTime() + DEFAULT_ALARM_LEAD_MINUTES * 60_000));

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
  /** Bundled sound file, or `undefined` for AlarmKit's own default. */
  soundName?: string;
};

/**
 * Everything about an alarm that AlarmKit won't tell us back — it reports only
 * ids. The reconcile compares this against what it last scheduled to decide
 * what needs re-scheduling, so it has to cover every field that reaches
 * AlarmKit: a retitled task and a changed sound both move no fire time, and
 * comparing fire times alone would leave the old alarm ringing until the next
 * launch.
 */
export const alarmSignature = (alarm: TAlarmSchedule): string =>
  [alarm.epochSeconds, alarm.title, alarm.soundName ?? ""].join("|");

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
 * @param scheduled     {@link alarmSignature} this session last scheduled per
 *                      id; lets us detect an edit to an existing alarm
 * @param now           reference time for the past-moment guard
 * @param soundName     bundled sound every alarm rings with (a preference, so
 *                      it applies to all of them); `undefined` = AlarmKit's own
 */
export const reconcileAlarms = (
  tasks: TAlarmTask[],
  existingIds: string[],
  scheduled: Map<string, string>,
  now: Date,
  soundName?: string,
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
      soundName,
    });
  }

  // Schedule anything we haven't already scheduled this session in exactly this
  // shape — a new alarm, or an edit to the time, title, or sound.
  const toSchedule = [...desired.values()].filter(
    (alarm) => scheduled.get(alarm.id) !== alarmSignature(alarm),
  );

  // Cancel anything AlarmKit still holds (or we tracked) that is no longer
  // desired — completed, deleted, unscheduled, or its time now sits in the past.
  const staleIds = new Set([...existingIds, ...scheduled.keys()]);
  const toCancel = [...staleIds].filter((id) => !desired.has(id));

  return { toSchedule, toCancel };
};
