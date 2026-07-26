import { scheduleAlarm } from "expo-alarm-kit";

// Imported directly rather than through `@/utils/alarms` so the iOS variant is
// exercised regardless of the resolver's platform (see docs/testing.md — the
// same reason `.web` files are imported by path). `expo-alarm-kit` is mocked in
// `jest.setup.js`.
import { scheduleTaskAlarm } from "../alarms.ios";

const mockScheduleAlarm = scheduleAlarm as jest.MockedFunction<
  typeof scheduleAlarm
>;

const alarm = { id: "task-1", title: "Take meds", epochSeconds: 1_800_000_000 };

describe("scheduleTaskAlarm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScheduleAlarm.mockResolvedValue(true);
  });

  it("passes the bundled sound filename to AlarmKit", async () => {
    await scheduleTaskAlarm(alarm, "echos.wav");

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

    await expect(scheduleTaskAlarm(alarm, "echos.wav")).rejects.toThrow(
      "task-1",
    );
  });
});
