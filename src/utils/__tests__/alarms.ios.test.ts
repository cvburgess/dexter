import { cancelAlarm, scheduleAlarm, scheduleTimerAlarm } from "expo-alarm-kit";

// Imported by path so the iOS variant is exercised regardless of the resolver's
// platform (see docs/testing.md); `expo-alarm-kit` is mocked in `jest.setup.js`.
import { scheduleFocusAlarm, scheduleTaskAlarm } from "../alarms.ios";

/** The dim theme's `primary`/`primaryContent`, deliberately far apart so a
 * transposition shows up as a wrong value rather than a passing assertion. */
const TINT = "#9fe88d";
const CONTENT = "#091307";
const COLORS = { tint: TINT, content: CONTENT };

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
    await scheduleTaskAlarm({ ...alarm, soundName: "echos.wav" }, COLORS);

    expect(mockScheduleAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1", soundName: "echos.wav" }),
    );
  });

  it("omits soundName entirely when there is no custom sound", async () => {
    // Passing an empty/undefined name would have AlarmKit resolve nothing; the
    // key has to be absent for it to fall back to `.default`.
    await scheduleTaskAlarm(alarm, COLORS);

    expect(mockScheduleAlarm).toHaveBeenCalledTimes(1);
    expect(mockScheduleAlarm.mock.calls[0][0]).not.toHaveProperty("soundName");
  });

  it("sends primaryContent alongside the tint so the widget need not derive it", async () => {
    // Both colours, in the right slots — a swap type-checks (both hex) and only
    // shows up on a device as an unreadable lock screen.
    await scheduleTaskAlarm(alarm, COLORS);

    expect(mockScheduleAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ tintColor: TINT, contentColor: CONTENT }),
    );
  });

  it("throws when AlarmKit rejects the alarm", async () => {
    mockScheduleAlarm.mockResolvedValue(false);

    await expect(scheduleTaskAlarm(alarm, COLORS)).rejects.toThrow("task-1");
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
    // Load-bearing for DEX-156: given a label, AlarmKit draws a pause button the
    // app can never honour (elapsed time is unreported). Fork makes it optional (DEX-158).
    await scheduleFocusAlarm(focusAlarm, COLORS);

    const options = mockScheduleTimerAlarm.mock.calls[0][0];
    expect(options).not.toHaveProperty("pauseButtonLabel");
    expect(options).not.toHaveProperty("resumeButtonLabel");
  });

  it("hands AlarmKit the remaining duration, not the fire instant", async () => {
    await scheduleFocusAlarm(focusAlarm, COLORS);

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
    await scheduleFocusAlarm(focusAlarm, COLORS);

    expect(mockCancelAlarm).toHaveBeenCalledWith("block-1");
    expect(mockCancelAlarm.mock.invocationCallOrder[0]).toBeLessThan(
      mockScheduleTimerAlarm.mock.invocationCallOrder[0],
    );
  });

  it("passes the bundled sound filename, and omits the key without one", async () => {
    await scheduleFocusAlarm({ ...focusAlarm, soundName: "echos.wav" }, COLORS);
    expect(mockScheduleTimerAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ soundName: "echos.wav" }),
    );

    mockScheduleTimerAlarm.mockClear();
    await scheduleFocusAlarm(focusAlarm, COLORS);
    expect(mockScheduleTimerAlarm.mock.calls[0][0]).not.toHaveProperty(
      "soundName",
    );
  });

  it("tints the countdown from the same colours a task alarm takes", async () => {
    // Kept in step with task alarms deliberately: one sound preference, one
    // colour pair, both read off the reader's theme at schedule time.
    await scheduleFocusAlarm(focusAlarm, COLORS);

    expect(mockScheduleTimerAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ tintColor: TINT, contentColor: CONTENT }),
    );
  });

  it("throws when AlarmKit rejects the timer", async () => {
    // A swallowed `false` would leave the user trusting a block that won't ring.
    mockScheduleTimerAlarm.mockResolvedValue(false);

    await expect(scheduleFocusAlarm(focusAlarm, COLORS)).rejects.toThrow(
      "block-1",
    );
  });
});
