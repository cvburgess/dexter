import { renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useAlarmSync } from "../useAlarmSync";

// The pure reconcile + native scheduling calls are mocked so this test drives
// only the hook's failure-notification behavior.
const mockAlarms = {
  reconcileAlarms: jest.fn(),
  scheduleTaskAlarm: jest.fn(),
  cancelTaskAlarm: jest.fn(),
  getScheduledAlarmIds: jest.fn(() => [] as string[]),
};
// Wrappers (not direct references) so `mockAlarms` is read at call time — the
// jest.mock factory is hoisted above the `const mockAlarms` initializer, so a
// direct reference would evaluate it while still undefined. getScheduledAlarmIds
// forwards no args (its zero-arg signature can't take a spread).
jest.mock("@/utils/alarms", () => ({
  reconcileAlarms: (...args: unknown[]) => mockAlarms.reconcileAlarms(...args),
  scheduleTaskAlarm: (...args: unknown[]) =>
    mockAlarms.scheduleTaskAlarm(...args),
  cancelTaskAlarm: (...args: unknown[]) => mockAlarms.cancelTaskAlarm(...args),
  getScheduledAlarmIds: () => mockAlarms.getScheduledAlarmIds(),
}));

// useTasks pulls in the supabase client; the hook only needs the tuple shape.
const tasksState = { isLoading: false };
jest.mock("../useTasks", () => ({
  useTasks: () => [[], { isLoading: tasksState.isLoading }],
}));

describe("useAlarmSync", () => {
  let alertSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    tasksState.isLoading = false;
    mockAlarms.getScheduledAlarmIds.mockReturnValue([]);
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    // The hook console.warns each failure; silence it to keep test output clean.
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("warns the user once even when multiple alarms fail to schedule", async () => {
    mockAlarms.reconcileAlarms.mockReturnValue({
      toSchedule: [
        { id: "a", title: "A", epochSeconds: 1 },
        { id: "b", title: "B", epochSeconds: 2 },
      ],
      toCancel: [],
    });
    mockAlarms.scheduleTaskAlarm.mockRejectedValue(new Error("rejected"));

    renderHook(() => useAlarmSync());

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0][0]).toBe("Alarm not set");
  });

  it("does not warn when scheduling succeeds", async () => {
    mockAlarms.reconcileAlarms.mockReturnValue({
      toSchedule: [{ id: "a", title: "A", epochSeconds: 1 }],
      toCancel: [],
    });
    mockAlarms.scheduleTaskAlarm.mockResolvedValue(undefined);

    renderHook(() => useAlarmSync());

    await waitFor(() =>
      expect(mockAlarms.scheduleTaskAlarm).toHaveBeenCalledTimes(1),
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
