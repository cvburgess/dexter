// Pure alarm scheduling math (DEX-48, DEX-156) shared by the platform variants
// of `utils/alarms` — native-free so reconciliation is testable without mocks.

import { Platform } from "react-native";

import { TTask } from "@/api/tasks";
import { liveRemainingSeconds, TFocusAnchor } from "@/utils/focusBlocks";
import { isCompletionStatus } from "@/utils/taskFilters";

/** The one gate every alarm surface uses. Mac Catalyst is excluded (DEX-85):
 * `Platform.OS` is "ios" there but AlarmKit isn't even linked into that build. */
export const isAlarmSupported =
  Platform.OS === "ios" && !Platform.isMacCatalyst;

/** Seeds a repeat template's alarm — recurring, so "now" is meaningless.
 * One-off task alarms use {@link defaultAlarmTime} instead. */
export const DEFAULT_ALARM_TIME = "09:00";

/** Minutes ahead a freshly-enabled one-off alarm is seeded, so accepting the
 * default never lands in the past (which would silently never ring). */
export const DEFAULT_ALARM_LEAD_MINUTES = 5;

/** A selectable alarm sound (see {@link ALARM_SOUNDS}). */
export type TAlarmSound = "system" | "echos";

/** What a fresh account rings with — Dexter's own sound, not iOS's (DEX-72). */
export const DEFAULT_ALARM_SOUND: TAlarmSound = "echos";

/** Adding a sound means an entry here *and* the file in the `withAlarmSound`
 * plugin's list in `app.json` — a name AlarmKit can't resolve rings nothing. */
export const ALARM_SOUNDS: readonly {
  value: TAlarmSound;
  label: string;
  fileName?: string;
}[] = [
  { value: "system", label: "System" },
  { value: "echos", label: "Echos", fileName: "echos.wav" },
];

/** A newer client can store a sound this build doesn't bundle; every consumer
 * degrades the same way — to the system sound — rather than ringing silently. */
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

/** Local time-of-day now (`"HH:MM"`) — the earliest a today alarm may fire, so
 * it doubles as the time picker's lower bound on the current day. */
export const currentAlarmTime = (now: Date = new Date()): string =>
  toTimeString(now);

/** Default for a one-off task's alarm: {@link DEFAULT_ALARM_LEAD_MINUTES} from
 * now, so accepting the default lands just ahead rather than in the past. */
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

/** The theme pair baked in at scheduling. An object because both are hex — a
 * transposition would type-check and leave the lock screen unreadable. */
export type TAlarmColors = {
  /** `colors.primary` — the lock-screen card's background wash. */
  tint: string;
  /** `colors.primaryContent` — the title, countdown and progress bar over it. */
  content: string;
};

/** What the reconcile compares to spot edits — must cover every field reaching
 * AlarmKit. Colours stay out, and as a pair (why: see `scheduleTaskAlarm`). */
export const alarmSignature = (alarm: TAlarmSchedule): string =>
  [alarm.epochSeconds, alarm.title, alarm.soundName ?? ""].join("|");

/** The local moment a task's alarm fires (`scheduledFor` + `alarmTime`), or
 * `null`: no time, no anchor date, unparseable, or already in the past. */
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
 * Diff the alarms that *should* exist against the ones already scheduled, so
 * the caller touches only new/changed/stale alarms instead of rebuilding all.
 * @param existingIds ids AlarmKit currently has scheduled (`getAllAlarms()`)
 * @param scheduled {@link alarmSignature} last scheduled per id — spots edits
 * @param soundName one preference for all alarms; `undefined` = AlarmKit's own
 * @param protectedIds ids this reconcile does not own — see `toCancel` below
 */
export const reconcileAlarms = (
  tasks: TAlarmTask[],
  existingIds: string[],
  scheduled: Map<string, string>,
  now: Date,
  soundName?: string,
  protectedIds: ReadonlySet<string> = new Set(),
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

  // `protectedIds` keeps the stale sweep off focus-block timers (DEX-156): ids
  // share one flat namespace, and AlarmKit parses every id as a UUID — no prefixes.
  const staleIds = new Set([...existingIds, ...scheduled.keys()]);
  const toCancel = [...staleIds].filter(
    (id) => !desired.has(id) && !protectedIds.has(id),
  );

  return { toSchedule, toCancel };
};

/** The shortest timer AlarmKit will take, mirroring `expo-alarm-kit`'s own
 * guard — it throws below this rather than returning `false`. */
export const MIN_TIMER_ALARM_SECONDS = 60;

/** A focus block's native countdown. Extends {@link TAlarmSchedule} so
 * {@link alarmSignature} covers it unchanged; AlarmKit gets `durationSeconds`. */
export type TFocusAlarm = TAlarmSchedule & { durationSeconds: number };

/** The native timer a block should have now, or `null` (paused, ended, inside
 * AlarmKit's 60s floor). Anchor-fixed `epochSeconds` keeps signatures equal. */
export const focusAlarmFor = (
  block: TFocusAnchor & { id: string; title: string },
  now: Date,
  soundName?: string,
): TFocusAlarm | null => {
  if (block.status !== "active" || !block.resumedAt) return null;

  const remaining = liveRemainingSeconds(block, now.getTime());
  if (remaining < MIN_TIMER_ALARM_SECONDS) return null;

  return {
    id: block.id,
    title: block.title,
    // Read off the anchor rather than `now + remaining`: rounding the halves
    // separately would jitter the signature by a second between calls.
    epochSeconds: Math.floor(
      (Date.parse(block.resumedAt) + block.remainingSeconds * 1000) / 1000,
    ),
    durationSeconds: Math.ceil(remaining),
    soundName,
  };
};
