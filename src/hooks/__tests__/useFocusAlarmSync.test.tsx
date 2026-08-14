import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { TFocusBlock } from "@/api/focusBlocks";

import { useFocusAlarmSync } from "../useFocusAlarmSync";

// Only the native calls are mocked; the pure helpers come from the real shared
// module, since this hook's whole job is bookkeeping against real signatures
// (the same split `useAlarmSync.test.tsx` uses). Wrappers rather than direct
// references because the jest.mock factory is hoisted above `mockAlarms`.
const mockAlarms = {
  scheduleFocusAlarm: jest.fn(),
  cancelTaskAlarm: jest.fn(),
};
jest.mock("@/utils/alarms", () => {
  const shared = jest.requireActual<typeof import("@/utils/alarms.shared")>(
    "@/utils/alarms.shared",
  );
  return {
    alarmSignature: shared.alarmSignature,
    alarmSoundFileName: shared.alarmSoundFileName,
    focusAlarmFor: shared.focusAlarmFor,
    scheduleFocusAlarm: (...args: unknown[]) =>
      mockAlarms.scheduleFocusAlarm(...args),
    cancelTaskAlarm: (...args: unknown[]) =>
      mockAlarms.cancelTaskAlarm(...args),
  };
});

// usePreferences pulls in the supabase client; only the sound matters here.
const preferencesState = { alarmSound: "echos", isLoading: false };
jest.mock("../usePreferences", () => ({
  useAlarmSoundPreference: () => preferencesState,
}));

const START = Date.parse("2026-08-13T10:00:00.000Z");

const block = (overrides: Partial<TFocusBlock> = {}): TFocusBlock =>
  ({
    id: "block-1",
    date: "2026-08-13",
    remainingSeconds: 1500,
    resumedAt: new Date(START).toISOString(),
    status: "active",
    taskId: "task-1",
    totalSeconds: 1500,
    tasks: { id: "task-1", title: "Write report" },
    ...overrides,
  }) as TFocusBlock;

describe("useFocusAlarmSync", () => {
  let alertSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(START);
    preferencesState.alarmSound = "echos";
    preferencesState.isLoading = false;
    mockAlarms.scheduleFocusAlarm.mockResolvedValue(undefined);
    mockAlarms.cancelTaskAlarm.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    alertSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("schedules the countdown for a running block, with the chosen sound", async () => {
    renderHook(() => useFocusAlarmSync(block()));

    await waitFor(() =>
      expect(mockAlarms.scheduleFocusAlarm).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "block-1",
          title: "Write report",
          durationSeconds: 1500,
          soundName: "echos.wav",
        }),
      ),
    );
  });

  it("schedules nothing at all when no block is running", async () => {
    renderHook(() => useFocusAlarmSync(null));

    await act(async () => {});
    expect(mockAlarms.scheduleFocusAlarm).not.toHaveBeenCalled();
    expect(mockAlarms.cancelTaskAlarm).not.toHaveBeenCalled();
  });

  it("waits for the real preferences row before scheduling", async () => {
    // Scheduling against the placeholder would ring the block with the default
    // sound and then immediately reschedule it (DEX-72).
    preferencesState.isLoading = true;
    const { rerender } = renderHook(() => useFocusAlarmSync(block()));

    await act(async () => {});
    expect(mockAlarms.scheduleFocusAlarm).not.toHaveBeenCalled();

    preferencesState.isLoading = false;
    rerender({});

    await waitFor(() =>
      expect(mockAlarms.scheduleFocusAlarm).toHaveBeenCalledTimes(1),
    );
  });

  it("does not reschedule a block that is still running unchanged", async () => {
    // A refetch — a realtime invalidation, a foreground — hands back a *new*
    // object carrying the same row. Rescheduling on that would cancel and
    // rebuild a perfectly good alarm, which on the lock screen means the
    // countdown blinking out and back for no reason. The effect watches the
    // anchor fields rather than the block, so an identical row is a no-op.
    const { rerender } = renderHook(
      ({ live }: { live: TFocusBlock | null }) => useFocusAlarmSync(live),
      { initialProps: { live: block() } },
    );

    await waitFor(() =>
      expect(mockAlarms.scheduleFocusAlarm).toHaveBeenCalledTimes(1),
    );

    jest.setSystemTime(START + 30_000);
    rerender({ live: block() });

    await act(async () => {});
    expect(mockAlarms.scheduleFocusAlarm).toHaveBeenCalledTimes(1);
    expect(mockAlarms.cancelTaskAlarm).not.toHaveBeenCalled();
  });

  it("reschedules when a resume moves the block's end", async () => {
    const { rerender } = renderHook(
      ({ live }: { live: TFocusBlock | null }) => useFocusAlarmSync(live),
      { initialProps: { live: block() } },
    );

    await waitFor(() =>
      expect(mockAlarms.scheduleFocusAlarm).toHaveBeenCalledTimes(1),
    );

    // Paused at 20:00 left, resumed five minutes later: the alarm has to move
    // with the new anchor, not keep the end the first schedule computed.
    jest.setSystemTime(START + 600_000);
    rerender({
      live: block({
        remainingSeconds: 1200,
        resumedAt: new Date(START + 600_000).toISOString(),
      }),
    });

    await waitFor(() =>
      expect(mockAlarms.scheduleFocusAlarm).toHaveBeenCalledTimes(2),
    );
    expect(mockAlarms.scheduleFocusAlarm).toHaveBeenLastCalledWith(
      expect.objectContaining({ durationSeconds: 1200 }),
    );
  });

  it("cancels the countdown when the block is paused", async () => {
    const { rerender } = renderHook(
      ({ live }: { live: TFocusBlock | null }) => useFocusAlarmSync(live),
      { initialProps: { live: block() } },
    );

    await waitFor(() =>
      expect(mockAlarms.scheduleFocusAlarm).toHaveBeenCalledTimes(1),
    );

    rerender({
      live: block({
        status: "paused",
        resumedAt: null,
        remainingSeconds: 1200,
      }),
    });

    await waitFor(() =>
      expect(mockAlarms.cancelTaskAlarm).toHaveBeenCalledWith("block-1"),
    );
    expect(mockAlarms.scheduleFocusAlarm).toHaveBeenCalledTimes(1);
  });

  it("cancels the countdown when the block ends", async () => {
    const { rerender } = renderHook(
      ({ live }: { live: TFocusBlock | null }) => useFocusAlarmSync(live),
      { initialProps: { live: block() } },
    );

    await waitFor(() =>
      expect(mockAlarms.scheduleFocusAlarm).toHaveBeenCalledTimes(1),
    );

    // Stopping or completing clears the live row outright, so the hook sees null.
    rerender({ live: null });

    await waitFor(() =>
      expect(mockAlarms.cancelTaskAlarm).toHaveBeenCalledWith("block-1"),
    );
  });

  it("schedules nothing inside the last minute, which AlarmKit won't take", async () => {
    // `scheduleTimerAlarm` throws below 60s rather than returning false, so an
    // unguarded call here would alert the user on every run.
    renderHook(() => useFocusAlarmSync(block({ remainingSeconds: 45 })));

    await act(async () => {});
    expect(mockAlarms.scheduleFocusAlarm).not.toHaveBeenCalled();
  });

  it("tells the user when the countdown could not be set", async () => {
    mockAlarms.scheduleFocusAlarm.mockRejectedValue(new Error("denied"));

    renderHook(() => useFocusAlarmSync(block()));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0][0]).toBe("Timer won't ring");
  });

  it("retries a failed schedule on the next run", async () => {
    // Left out of the cache on failure, so a foreground or a launch tries again
    // rather than leaving the user trusting a block that won't ring.
    mockAlarms.scheduleFocusAlarm.mockRejectedValueOnce(new Error("denied"));
    const live = block();
    const { rerender } = renderHook(() => useFocusAlarmSync(live));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));

    preferencesState.alarmSound = "system";
    rerender({});

    await waitFor(() =>
      expect(mockAlarms.scheduleFocusAlarm).toHaveBeenCalledTimes(2),
    );
  });
});
