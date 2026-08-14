import { cancelAlarm, scheduleAlarm, scheduleTimerAlarm } from "expo-alarm-kit";

// Imported directly rather than through `@/utils/alarms` so the iOS variant is
// exercised regardless of the resolver's platform (see docs/testing.md — the
// same reason `.web` files are imported by path). `expo-alarm-kit` is mocked in
// `jest.setup.js`.
import { scheduleFocusAlarm, scheduleTaskAlarm } from "../alarms.ios";

const mockScheduleAlarm = scheduleAlarm as jest.MockedFunction<
  typeof scheduleAlarm
>;
const mockScheduleTimerAlarm = scheduleTimerAlarm as jest.MockedFunction<
  typeof scheduleTimerAlarm
>;
const mockCancelAlarm = cancelAlarm as jest.MockedFunction<typeof cancelAlarm>;

const alarm = { id: "task-1", title: "Take meds", epochSeconds: 1_800_000_000 };

describe("scheduleTaskAlarm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScheduleAlarm.mockResolvedValue(true);
  });

  it("passes the bundled sound filename to AlarmKit", async () => {
    await scheduleTaskAlarm({ ...alarm, soundName: "echos.wav" });

    expect(mockScheduleAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1", soundName: "echos.wav" }),
    );
  });

  it("omits soundName entirely when there is no custom sound", async () => {
    // Passing an empty/undefined name would have AlarmKit resolve nothing; the
    // key has to be absent for it to fall back to `.default`.
    await scheduleTaskAlarm(alarm);

    expect(mockScheduleAlarm).toHaveBeenCalledTimes(1);
    expect(mockScheduleAlarm.mock.calls[0][0]).not.toHaveProperty("soundName");
  });

  it("throws when AlarmKit rejects the alarm", async () => {
    mockScheduleAlarm.mockResolvedValue(false);

    await expect(scheduleTaskAlarm(alarm)).rejects.toThrow("task-1");
  });
});

describe("scheduleFocusAlarm", () => {
  const focusAlarm = {
    id: "block-1",
    title: "Write report",
    epochSeconds: 1_800_000_000,
    durationSeconds: 600,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockScheduleTimerAlarm.mockResolvedValue(true);
    mockCancelAlarm.mockResolvedValue(true);
  });

  it("passes no pause or resume label, so the countdown carries no controls", async () => {
    // The load-bearing assertion of DEX-156. Given either label, AlarmKit draws
    // a button the app can never honour: `AlarmManager.shared.alarms` reports a
    // paused alarm's state but never its elapsed time, so a lock-screen pause
    // could only be mirrored into `remaining_seconds` as a guess. Omitting them
    // relies on `patches/expo-alarm-kit+0.1.11.patch`.
    await scheduleFocusAlarm(focusAlarm);

    const options = mockScheduleTimerAlarm.mock.calls[0][0];
    expect(options).not.toHaveProperty("pauseButtonLabel");
    expect(options).not.toHaveProperty("resumeButtonLabel");
  });

  it("hands AlarmKit the remaining duration, not the fire instant", async () => {
    await scheduleFocusAlarm(focusAlarm);

    expect(mockScheduleTimerAlarm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "block-1",
        title: "Write report",
        duration: 600,
        launchAppOnDismiss: true,
        dismissPayload: "block-1",
      }),
    );
  });

  it("cancels before scheduling so a resume replaces rather than duplicates", async () => {
    await scheduleFocusAlarm(focusAlarm);

    expect(mockCancelAlarm).toHaveBeenCalledWith("block-1");
    expect(mockCancelAlarm.mock.invocationCallOrder[0]).toBeLessThan(
      mockScheduleTimerAlarm.mock.invocationCallOrder[0],
    );
  });

  it("passes the bundled sound filename, and omits the key without one", async () => {
    await scheduleFocusAlarm({ ...focusAlarm, soundName: "echos.wav" });
    expect(mockScheduleTimerAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ soundName: "echos.wav" }),
    );

    mockScheduleTimerAlarm.mockClear();
    await scheduleFocusAlarm(focusAlarm);
    expect(mockScheduleTimerAlarm.mock.calls[0][0]).not.toHaveProperty(
      "soundName",
    );
  });

  it("throws when AlarmKit rejects the timer", async () => {
    // A swallowed `false` would leave the user trusting a block that won't ring.
    mockScheduleTimerAlarm.mockResolvedValue(false);

    await expect(scheduleFocusAlarm(focusAlarm)).rejects.toThrow("block-1");
  });
});
