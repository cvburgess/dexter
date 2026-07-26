import { ETaskStatus, TTask } from "@/api/tasks";
import {
  ALARM_SOUNDS,
  alarmFireDate,
  alarmSignature,
  alarmSoundFileName,
  currentAlarmTime,
  DEFAULT_ALARM_LEAD_MINUTES,
  DEFAULT_ALARM_SOUND,
  defaultAlarmTime,
  reconcileAlarms,
  resolveAlarmSound,
  TAlarmSchedule,
  TAlarmTask,
} from "@/utils/alarms.shared";

const NOW = new Date(2026, 6, 17, 12, 0, 0); // 2026-07-17 12:00 local

const alarmTask = (overrides: Partial<TAlarmTask> = {}): TAlarmTask => ({
  id: "task-1",
  title: "Take meds",
  alarmTime: "17:30",
  scheduledFor: "2026-07-17",
  status: ETaskStatus.TODO,
  ...overrides,
});

describe("alarmFireDate", () => {
  it("combines the scheduled date and alarm time into a local moment", () => {
    const fire = alarmFireDate(
      { alarmTime: "17:30", scheduledFor: "2026-07-17" },
      NOW,
    );
    expect(fire).toEqual(new Date(2026, 6, 17, 17, 30, 0, 0));
  });

  it("accepts a Postgres 'HH:MM:SS' time and ignores the seconds", () => {
    const fire = alarmFireDate(
      { alarmTime: "08:15:00", scheduledFor: "2026-07-18" },
      NOW,
    );
    expect(fire).toEqual(new Date(2026, 6, 18, 8, 15, 0, 0));
  });

  it("returns null when there is no alarm time", () => {
    expect(
      alarmFireDate({ alarmTime: null, scheduledFor: "2026-07-17" }, NOW),
    ).toBeNull();
  });

  it("returns null when there is no scheduled date to anchor to", () => {
    expect(
      alarmFireDate({ alarmTime: "17:30", scheduledFor: null }, NOW),
    ).toBeNull();
  });

  it("returns null when the moment is already in the past", () => {
    // 09:00 today is before NOW (12:00).
    expect(
      alarmFireDate({ alarmTime: "09:00", scheduledFor: "2026-07-17" }, NOW),
    ).toBeNull();
  });
});

describe("reconcileAlarms", () => {
  const FIRE_EPOCH = Math.floor(new Date(2026, 6, 17, 17, 30).getTime() / 1000);

  /** What the session cache holds after `alarmTask()`'s alarm was scheduled. */
  const alreadyScheduled = (
    overrides: Partial<TAlarmSchedule> = {},
  ): Map<string, string> =>
    new Map([
      [
        "task-1",
        alarmSignature({
          id: "task-1",
          title: "Take meds",
          epochSeconds: FIRE_EPOCH,
          ...overrides,
        }),
      ],
    ]);

  it("schedules an alarm that isn't yet tracked or scheduled", () => {
    const { toSchedule, toCancel } = reconcileAlarms(
      [alarmTask()],
      [],
      new Map(),
      NOW,
    );

    expect(toCancel).toEqual([]);
    expect(toSchedule).toEqual([
      {
        id: "task-1",
        title: "Take meds",
        epochSeconds: Math.floor(
          new Date(2026, 6, 17, 17, 30).getTime() / 1000,
        ),
      },
    ]);
  });

  it("leaves an unchanged, already-scheduled alarm alone", () => {
    const { toSchedule, toCancel } = reconcileAlarms(
      [alarmTask()],
      ["task-1"],
      alreadyScheduled(),
      NOW,
    );

    expect(toSchedule).toEqual([]);
    expect(toCancel).toEqual([]);
  });

  it("re-schedules an alarm whose time was edited", () => {
    const { toSchedule } = reconcileAlarms(
      [alarmTask({ alarmTime: "17:30" })],
      ["task-1"],
      alreadyScheduled({
        epochSeconds: Math.floor(new Date(2026, 6, 17, 10, 0).getTime() / 1000),
      }),
      NOW,
    );

    expect(toSchedule.map((a) => a.id)).toEqual(["task-1"]);
  });

  // AlarmKit reports only ids, so an edit that moves no fire time is invisible
  // unless the whole scheduled shape is compared (DEX-72).
  it("re-schedules an alarm whose title was edited", () => {
    const { toSchedule } = reconcileAlarms(
      [alarmTask({ title: "Take meds after lunch" })],
      ["task-1"],
      alreadyScheduled(),
      NOW,
    );

    expect(toSchedule.map((a) => a.title)).toEqual(["Take meds after lunch"]);
  });

  it("re-schedules every alarm when the sound changes", () => {
    const { toSchedule } = reconcileAlarms(
      [alarmTask()],
      ["task-1"],
      alreadyScheduled({ soundName: "echos.wav" }),
      NOW,
      undefined, // switched back to the system sound
    );

    expect(toSchedule.map((a) => a.id)).toEqual(["task-1"]);
  });

  it("stamps the selected sound onto each alarm it schedules", () => {
    const { toSchedule } = reconcileAlarms(
      [alarmTask()],
      [],
      new Map(),
      NOW,
      "echos.wav",
    );

    expect(toSchedule.map((a) => a.soundName)).toEqual(["echos.wav"]);
  });

  it("cancels a scheduled alarm that is no longer desired", () => {
    const { toSchedule, toCancel } = reconcileAlarms(
      [alarmTask({ alarmTime: null })], // alarm cleared
      ["task-1"],
      alreadyScheduled(),
      NOW,
    );

    expect(toSchedule).toEqual([]);
    expect(toCancel).toEqual(["task-1"]);
  });

  it("excludes completed tasks and cancels their existing alarm", () => {
    const { toSchedule, toCancel } = reconcileAlarms(
      [alarmTask({ status: ETaskStatus.DONE })],
      ["task-1"],
      new Map(),
      NOW,
    );

    expect(toSchedule).toEqual([]);
    expect(toCancel).toEqual(["task-1"]);
  });

  it("ignores tasks whose alarm moment has already passed", () => {
    const { toSchedule, toCancel } = reconcileAlarms(
      [alarmTask({ alarmTime: "09:00" })],
      [],
      new Map(),
      NOW,
    );

    expect(toSchedule).toEqual([]);
    expect(toCancel).toEqual([]);
  });

  it("narrows a full TTask to the fields it needs", () => {
    // Type-level assurance that TTask is assignable to the reconcile input.
    const task: TTask = {
      id: "task-2",
      alarmTime: "20:00",
      dueOn: null,
      goalId: null,
      listId: null,
      priority: 4,
      scheduledFor: "2026-07-17",
      status: ETaskStatus.TODO,
      subtasks: [],
      templateId: null,
      title: "Water plants",
    };

    const { toSchedule } = reconcileAlarms([task], [], new Map(), NOW);
    expect(toSchedule.map((a) => a.id)).toEqual(["task-2"]);
  });
});

describe("currentAlarmTime", () => {
  it("formats the current local time-of-day as zero-padded HH:MM", () => {
    expect(currentAlarmTime(new Date(2026, 6, 17, 9, 5, 42))).toBe("09:05");
    expect(currentAlarmTime(new Date(2026, 6, 17, 14, 30, 0))).toBe("14:30");
  });
});

describe("defaultAlarmTime", () => {
  it("seeds a few minutes ahead of now so the default isn't already past", () => {
    expect(defaultAlarmTime(new Date(2026, 6, 17, 9, 0, 0))).toBe("09:05");
    expect(DEFAULT_ALARM_LEAD_MINUTES).toBe(5);
  });

  it("rolls the hour over when the lead crosses a boundary", () => {
    expect(defaultAlarmTime(new Date(2026, 6, 17, 9, 58, 0))).toBe("10:03");
  });
});

describe("alarmSoundFileName", () => {
  it("resolves a bundled sound to the filename AlarmKit rings", () => {
    expect(alarmSoundFileName("echos")).toBe("echos.wav");
  });

  it("resolves the system sound to undefined so AlarmKit keeps its default", () => {
    expect(alarmSoundFileName("system")).toBeUndefined();
  });

  it("falls back to the system sound for a value this build doesn't ship", () => {
    // A newer client (or a hand-edited row) can name a sound that isn't in this
    // bundle — passing it through would resolve to silence.
    expect(alarmSoundFileName("chimes")).toBeUndefined();
    expect(resolveAlarmSound("chimes")).toBe("system");
  });

  it("resolves a sound this build does ship to itself", () => {
    expect(resolveAlarmSound("echos")).toBe("echos");
  });

  it("ships a bundled file for the default sound", () => {
    expect(alarmSoundFileName(DEFAULT_ALARM_SOUND)).toBe("echos.wav");
  });

  it("offers the system sound as an option so the custom sound is opt-out", () => {
    expect(ALARM_SOUNDS.map(({ value }) => value)).toContain("system");
  });
});
