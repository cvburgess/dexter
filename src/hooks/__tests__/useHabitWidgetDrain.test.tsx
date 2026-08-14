import { renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

import { THabit } from "@/api/habits";

import { useHabitWidgetDrain } from "../useHabitWidgetDrain";

// Only the App Group side effects and the write are mocked. The key format
// comes from the real module, so a change to `pendingHabitStepsKey` fails here
// rather than silently leaving every queued step unparseable.
const mockWidgets = {
  readPendingHabitSteps: jest.fn<Record<string, number>, []>(() => ({})),
  clearPendingHabitSteps: jest.fn(),
};
jest.mock("@/utils/widgets", () => {
  const shared = jest.requireActual<typeof import("@/utils/widgets.shared")>(
    "@/utils/widgets.shared",
  );
  return {
    ...shared,
    readPendingHabitSteps: () => mockWidgets.readPendingHabitSteps(),
    clearPendingHabitSteps: (...args: unknown[]) =>
      mockWidgets.clearPendingHabitSteps(...args),
  };
});

const mockUpsertDailyHabit = jest.fn();
jest.mock("@/api/habits", () => ({
  upsertDailyHabit: (...args: unknown[]) => mockUpsertDailyHabit(...args),
}));

const mockAuthState: { session: object | null } = { session: { user: {} } };
jest.mock("../useAuth", () => ({
  supabase: {},
  useAuth: () => mockAuthState,
}));

const habit = (overrides: Partial<THabit> = {}): THabit => ({
  id: "habit-1",
  daysActive: [1, 2, 3, 4, 5, 6, 7],
  emoji: "💧",
  isArchived: false,
  isPaused: false,
  steps: 8,
  title: "Drink water",
  ...overrides,
});

const mockHabitsState: { habits: THabit[]; isLoading: boolean } = {
  habits: [habit()],
  isLoading: false,
};
jest.mock("../useHabits", () => ({
  HABITS_INVALIDATION_KEYS: [["habits"], ["dailyHabits"]],
  useHabits: () => [
    mockHabitsState.habits,
    { isLoading: mockHabitsState.isLoading },
  ],
}));

const mockInvalidateQueries = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const KEY = "2026-07-16|habit-1";

describe("useHabitWidgetDrain", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.session = { user: {} };
    mockHabitsState.habits = [habit()];
    mockHabitsState.isLoading = false;
    mockWidgets.readPendingHabitSteps.mockReturnValue({});
    mockUpsertDailyHabit.mockResolvedValue(undefined);
  });

  it("persists each queued step and clears it", async () => {
    mockWidgets.readPendingHabitSteps.mockReturnValue({ [KEY]: 3 });

    renderHook(() => useHabitWidgetDrain());

    await waitFor(() => expect(mockUpsertDailyHabit).toHaveBeenCalledTimes(1));
    expect(mockUpsertDailyHabit).toHaveBeenCalledWith(expect.anything(), {
      date: "2026-07-16",
      habitId: "habit-1",
      steps: 8,
      stepsComplete: 3,
    });
    expect(mockWidgets.clearPendingHabitSteps).toHaveBeenCalledWith([KEY]);
    // The daily rows only. A step changes nothing about the habit itself, and
    // refetching the list would re-render the tree root for no new data.
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["dailyHabits"],
    });
  });

  it("clamps a step the habit's target has since dropped below", async () => {
    // The intent computed against the target the snapshot carried; the app can
    // have lowered it since. The DB trigger clamps an existing row, so without
    // this a row *created* by the upsert would be the one place that escapes.
    mockHabitsState.habits = [habit({ steps: 2 })];
    mockWidgets.readPendingHabitSteps.mockReturnValue({ [KEY]: 5 });

    renderHook(() => useHabitWidgetDrain());

    await waitFor(() => expect(mockUpsertDailyHabit).toHaveBeenCalled());
    expect(mockUpsertDailyHabit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ steps: 2, stepsComplete: 2 }),
    );
  });

  it("waits for the habits list before draining", async () => {
    // Draining against the empty list a cold start begins with would treat
    // every queued step as belonging to a deleted habit and discard the lot.
    mockHabitsState.habits = [];
    mockHabitsState.isLoading = true;
    mockWidgets.readPendingHabitSteps.mockReturnValue({ [KEY]: 3 });

    const { rerender } = renderHook(() => useHabitWidgetDrain());
    expect(mockWidgets.readPendingHabitSteps).not.toHaveBeenCalled();

    mockHabitsState.habits = [habit()];
    mockHabitsState.isLoading = false;
    rerender({});

    await waitFor(() => expect(mockUpsertDailyHabit).toHaveBeenCalledTimes(1));
  });

  it("drops an entry whose habit no longer exists, without writing it", async () => {
    mockHabitsState.habits = [habit({ id: "other" })];
    mockWidgets.readPendingHabitSteps.mockReturnValue({ [KEY]: 3 });

    renderHook(() => useHabitWidgetDrain());

    await waitFor(() =>
      expect(mockWidgets.clearPendingHabitSteps).toHaveBeenCalledWith([KEY]),
    );
    expect(mockUpsertDailyHabit).not.toHaveBeenCalled();
    // Nothing reached the database, so nothing needs refetching.
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it("leaves a step that failed to persist in the queue", async () => {
    // Offline, or a row the server rejected. The widget is still showing the
    // value, so the user sees no regression while it waits for the next try.
    mockUpsertDailyHabit.mockRejectedValue(new Error("offline"));
    mockWidgets.readPendingHabitSteps.mockReturnValue({ [KEY]: 3 });

    renderHook(() => useHabitWidgetDrain());

    await waitFor(() =>
      expect(mockWidgets.clearPendingHabitSteps).toHaveBeenCalledWith([]),
    );
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it("drains again when the app returns to the foreground", async () => {
    const listeners: ((state: string) => void)[] = [];
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, handler) => {
        listeners.push(handler as (state: string) => void);
        return { remove: jest.fn() };
      });

    mockWidgets.readPendingHabitSteps.mockReturnValue({ [KEY]: 3 });
    renderHook(() => useHabitWidgetDrain());
    await waitFor(() => expect(mockUpsertDailyHabit).toHaveBeenCalledTimes(1));

    mockWidgets.readPendingHabitSteps.mockReturnValue({
      "2026-07-17|habit-1": 1,
    });
    listeners.forEach((listener) => listener("active"));

    await waitFor(() => expect(mockUpsertDailyHabit).toHaveBeenCalledTimes(2));
  });

  it("does nothing on an empty queue, or while signed out", () => {
    renderHook(() => useHabitWidgetDrain());

    expect(mockUpsertDailyHabit).not.toHaveBeenCalled();
    expect(mockWidgets.clearPendingHabitSteps).not.toHaveBeenCalled();

    mockAuthState.session = null;
    mockWidgets.readPendingHabitSteps.mockReturnValue({ [KEY]: 3 });
    renderHook(() => useHabitWidgetDrain());

    // `useWidgetSync` has already emptied the queue on the way out; reading it
    // here would only race that.
    expect(mockUpsertDailyHabit).not.toHaveBeenCalled();
  });
});
