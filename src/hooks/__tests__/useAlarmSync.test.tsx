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
// forwards no args (its zero-arg signature can't take a spread). The pure
// helpers come from the real shared module: the hook's bookkeeping is only
// meaningful against real signatures and filenames.
jest.mock("@/utils/alarms", () => {
  const shared = jest.requireActual<typeof import("@/utils/alarms.shared")>(
    "@/utils/alarms.shared",
  );
  return {
    alarmSignature: shared.alarmSignature,
    alarmSoundFileName: shared.alarmSoundFileName,
    reconcileAlarms: (...args: unknown[]) =>
      mockAlarms.reconcileAlarms(...args),
    scheduleTaskAlarm: (...args: unknown[]) =>
      mockAlarms.scheduleTaskAlarm(...args),
    cancelTaskAlarm: (...args: unknown[]) =>
      mockAlarms.cancelTaskAlarm(...args),
    getScheduledAlarmIds: () => mockAlarms.getScheduledAlarmIds(),
  };
});

// useTasks pulls in the supabase client; the hook only needs the tuple shape.
const tasksState = { isLoading: false };
jest.mock("../useTasks", () => ({
  useTasks: () => [[], { isLoading: tasksState.isLoading }],
}));

// usePreferences pulls in the supabase client too; only the sound matters here.
const preferencesState = { alarmSound: "echos", isLoading: false };
jest.mock("../usePreferences", () => ({
  useAlarmSoundPreference: () => preferencesState,
}));

// useFocusBlocks pulls in the supabase client as well; the hook reads only the
// live block's id, to keep its alarm out of the reconcile's cancel sweep.
const focusBlockState: { id: string | null; isLoading: boolean } = {
  id: null,
  isLoading: false,
};
jest.mock("../useFocusBlocks", () => ({
  useLiveFocusBlockId: () => focusBlockState,
}));

describe("useAlarmSync", () => {
  let alertSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    tasksState.isLoading = false;
    preferencesState.alarmSound = "echos";
    preferencesState.isLoading = false;
    focusBlockState.id = null;
    focusBlockState.isLoading = false;
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

  it("hands the reconcile the sound file the preference selects", async () => {
    mockAlarms.reconcileAlarms.mockReturnValue({
      toSchedule: [],
      toCancel: [],
    });

    const { rerender } = renderHook(() => useAlarmSync());
    await waitFor(() =>
      expect(mockAlarms.reconcileAlarms).toHaveBeenLastCalledWith(
        [],
        [],
        expect.any(Map),
        expect.any(Date),
        "echos.wav",
        expect.any(Set),
      ),
    );

    preferencesState.alarmSound = "system";
    rerender({});

    await waitFor(() =>
      expect(mockAlarms.reconcileAlarms).toHaveBeenLastCalledWith(
        [],
        [],
        expect.any(Map),
        expect.any(Date),
        undefined,
        expect.any(Set),
      ),
    );
  });

  // The preferences query serves the defaults as placeholder data, so acting
  // before the saved row lands would ring every alarm with the default sound and
  // then re-schedule the lot (DEX-72).
  it("waits for the saved preferences before touching AlarmKit", async () => {
    preferencesState.isLoading = true;
    mockAlarms.reconcileAlarms.mockReturnValue({
      toSchedule: [],
      toCancel: [],
    });

    const { rerender } = renderHook(() => useAlarmSync());
    expect(mockAlarms.reconcileAlarms).not.toHaveBeenCalled();

    preferencesState.isLoading = false;
    rerender({});

    await waitFor(() => expect(mockAlarms.reconcileAlarms).toHaveBeenCalled());
  });

  // What's recorded has to be the full signature, not just the fire time —
  // that's what lets the next reconcile notice a title or sound edit. Read at
  // call time, because the hook passes the live Map by reference.
  it("records the signature of what it scheduled, not just the fire time", async () => {
    const seen: (string | undefined)[] = [];
    mockAlarms.reconcileAlarms.mockImplementation(
      (_tasks: unknown, _ids: unknown, scheduled: Map<string, string>) => {
        seen.push(scheduled.get("a"));
        return {
          toSchedule: [
            { id: "a", title: "A", epochSeconds: 1, soundName: "echos.wav" },
          ],
          toCancel: [],
        };
      },
    );
    mockAlarms.scheduleTaskAlarm.mockResolvedValue(undefined);

    const { rerender } = renderHook(() => useAlarmSync());
    await waitFor(() => expect(seen).toEqual([undefined]));

    rerender({});

    await waitFor(() => expect(seen).toEqual([undefined, "1|A|echos.wav"]));
  });

  // A sound change (or any task edit) re-fires the effect with a schedule still
  // in flight. Overlapping runs would each reconcile against a cache the other
  // hasn't written yet — re-scheduling alarms that are already correct, and
  // racing on the same id, so AlarmKit can end up holding the losing run's
  // sound while the cache records the winner's.
  it("queues a second run behind the first instead of overlapping it", async () => {
    const seen: (string | undefined)[] = [];
    mockAlarms.reconcileAlarms.mockImplementation(
      (_tasks: unknown, _ids: unknown, scheduled: Map<string, string>) => {
        seen.push(scheduled.get("a"));
        return {
          toSchedule: [
            { id: "a", title: "A", epochSeconds: 1, soundName: "echos.wav" },
          ],
          toCancel: [],
        };
      },
    );
    let release: () => void = () => {};
    mockAlarms.scheduleTaskAlarm.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    mockAlarms.scheduleTaskAlarm.mockResolvedValue(undefined);

    const { rerender } = renderHook(() => useAlarmSync());
    await waitFor(() => expect(seen).toEqual([undefined]));

    // Re-render while the first run's schedule is still pending.
    rerender({});
    expect(seen).toEqual([undefined]);

    release();

    // The queued run reconciles against what the first one actually recorded.
    await waitFor(() => expect(seen).toEqual([undefined, "1|A|echos.wav"]));
  });
});
