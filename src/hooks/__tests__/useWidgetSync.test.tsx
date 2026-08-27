import { Temporal } from "@js-temporal/polyfill";
import { renderHook } from "@testing-library/react-native";

import { TDailyHabit, THabit } from "@/api/habits";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { EThemeMode } from "@/api/preferences";

import { useWidgetSync } from "../useWidgetSync";

// Only the two side effects are mocked; buildWidgetSnapshot is real, since the
// point of the hook is *when* it publishes against a genuine payload.
const mockWidgets = {
  writeWidgetSnapshot: jest.fn(),
  clearWidgetSnapshot: jest.fn(),
  writeHabitWidgetSnapshot: jest.fn(),
  clearHabitWidgetSnapshot: jest.fn(),
};
// Wrappers rather than direct references: the jest.mock factory is hoisted above
// the `const mockWidgets` initializer.
jest.mock("@/utils/widgets", () => {
  const shared = jest.requireActual<typeof import("@/utils/widgets.shared")>(
    "@/utils/widgets.shared",
  );
  return {
    ...shared,
    writeWidgetSnapshot: (...args: unknown[]) =>
      mockWidgets.writeWidgetSnapshot(...args),
    clearWidgetSnapshot: () => mockWidgets.clearWidgetSnapshot(),
    writeHabitWidgetSnapshot: (...args: unknown[]) =>
      mockWidgets.writeHabitWidgetSnapshot(...args),
    clearHabitWidgetSnapshot: () => mockWidgets.clearHabitWidgetSnapshot(),
  };
});

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  title: "Write report",
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.URGENT,
  scheduledFor: null,
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  url: null,
  ...overrides,
});

// useTasks pulls in the supabase client; the hook only needs the tuple shape.
const mockTasksState: { tasks: TTask[]; isLoading: boolean } = {
  tasks: [],
  isLoading: false,
};
jest.mock("../useTasks", () => ({
  useTasks: () => [
    mockTasksState.tasks,
    { isLoading: mockTasksState.isLoading },
  ],
}));

const mockAuthState: { session: object | null; initializing: boolean } = {
  session: { user: {} },
  initializing: false,
};
jest.mock("../useAuth", () => ({
  useAuth: () => mockAuthState,
}));

const mockThemeState = {
  themeMode: EThemeMode.SYSTEM,
  lightTheme: "dexter",
  darkTheme: "dark",
  isLoading: false,
};
const mockHabitsEnabledState = { enableHabits: true, isLoading: false };
jest.mock("../usePreferences", () => ({
  useThemePreferences: () => mockThemeState,
  useHabitsEnabledPreference: () => mockHabitsEnabledState,
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
  habits: [],
  isLoading: false,
};
const mockDailyHabitsState: {
  dailyHabits: TDailyHabit[];
  isLoading: boolean;
} = { dailyHabits: [], isLoading: false };
jest.mock("../useHabits", () => ({
  useHabits: () => [
    mockHabitsState.habits,
    { isLoading: mockHabitsState.isLoading },
  ],
  useDailyHabitProgress: () => mockDailyHabitsState,
}));

describe("useWidgetSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTasksState.tasks = [];
    mockTasksState.isLoading = false;
    mockAuthState.session = { user: {} };
    mockAuthState.initializing = false;
    mockThemeState.themeMode = EThemeMode.SYSTEM;
    mockThemeState.lightTheme = "dexter";
    mockThemeState.darkTheme = "dark";
    mockThemeState.isLoading = false;
    mockHabitsEnabledState.enableHabits = true;
    mockHabitsEnabledState.isLoading = false;
    mockHabitsState.habits = [];
    mockHabitsState.isLoading = false;
    mockDailyHabitsState.dailyHabits = [];
    mockDailyHabitsState.isLoading = false;
  });

  it("publishes a snapshot once both queries have settled", () => {
    mockTasksState.tasks = [task({ scheduledFor: "2026-07-16" })];

    renderHook(() => useWidgetSync());

    expect(mockWidgets.writeWidgetSnapshot).toHaveBeenCalledTimes(1);
    const [snapshot] = mockWidgets.writeWidgetSnapshot.mock.calls[0];
    expect(snapshot.days).toHaveLength(4);
    expect(snapshot.light.background).toBe("#fffbf4");
  });

  it("publishes nothing while the tasks query is still loading", () => {
    // The placeholder is `[]`, which would put an empty "All done!" on the home
    // screen and then spend a second widget reload replacing it.
    mockTasksState.isLoading = true;

    renderHook(() => useWidgetSync());

    expect(mockWidgets.writeWidgetSnapshot).not.toHaveBeenCalled();
  });

  it("publishes nothing while the theme preferences are still loading", () => {
    mockThemeState.isLoading = true;

    renderHook(() => useWidgetSync());

    expect(mockWidgets.writeWidgetSnapshot).not.toHaveBeenCalled();
  });

  it("does not republish when the payload is unchanged", () => {
    mockTasksState.tasks = [task({ scheduledFor: "2026-07-16" })];

    const { rerender } = renderHook(() => useWidgetSync());
    // A new array with equal contents — what a refetch that changed nothing
    // hands back. Widget reloads are metered, so this must cost nothing.
    mockTasksState.tasks = [task({ scheduledFor: "2026-07-16" })];
    rerender({});

    expect(mockWidgets.writeWidgetSnapshot).toHaveBeenCalledTimes(1);
  });

  it("republishes when the theme changes", () => {
    const { rerender } = renderHook(() => useWidgetSync());
    mockThemeState.lightTheme = "light";
    rerender({});

    expect(mockWidgets.writeWidgetSnapshot).toHaveBeenCalledTimes(2);
    const [latest] = mockWidgets.writeWidgetSnapshot.mock.calls[1];
    expect(latest.light.background).toBe("#ffffff");
  });

  it("clears the snapshot on sign-out so the next user sees nothing", () => {
    mockTasksState.tasks = [task({ scheduledFor: "2026-07-16" })];

    const { rerender } = renderHook(() => useWidgetSync());
    mockAuthState.session = null;
    rerender({});

    expect(mockWidgets.clearWidgetSnapshot).toHaveBeenCalledTimes(1);
  });

  it("clears a snapshot a previous launch left behind", () => {
    // A token revoked while the app was closed: this process never published,
    // but the App Group still holds the last session's tasks.
    mockAuthState.session = null;

    renderHook(() => useWidgetSync());

    expect(mockWidgets.clearWidgetSnapshot).toHaveBeenCalledTimes(1);
    expect(mockWidgets.writeWidgetSnapshot).not.toHaveBeenCalled();
  });

  it("clears only once while signed out", () => {
    mockAuthState.session = null;

    const { rerender } = renderHook(() => useWidgetSync());
    mockTasksState.tasks = [task({ scheduledFor: "2026-07-16" })];
    rerender({});

    expect(mockWidgets.clearWidgetSnapshot).toHaveBeenCalledTimes(1);
  });

  it("touches nothing while auth is still restoring", () => {
    // session is null on every cold start until the stored one loads; clearing
    // here would flash the empty state before repopulating a beat later.
    mockAuthState.session = null;
    mockAuthState.initializing = true;

    renderHook(() => useWidgetSync());

    expect(mockWidgets.clearWidgetSnapshot).not.toHaveBeenCalled();
    expect(mockWidgets.writeWidgetSnapshot).not.toHaveBeenCalled();
  });

  // The hook slices its window off `Temporal.Now`, so anything that has to land
  // *inside* that window has to be dated from the same clock.
  const TODAY = Temporal.Now.plainDateISO().toString();

  describe("habits (DEX-160)", () => {
    it("publishes the habits payload alongside the tasks one", () => {
      mockHabitsState.habits = [habit()];

      renderHook(() => useWidgetSync());

      expect(mockWidgets.writeHabitWidgetSnapshot).toHaveBeenCalledTimes(1);
      const [snapshot] = mockWidgets.writeHabitWidgetSnapshot.mock.calls[0] as [
        { days: { habits: { id: string }[] }[] },
      ];
      expect(snapshot.days).toHaveLength(4);
      expect(snapshot.days[0].habits.map((h) => h.id)).toEqual(["habit-1"]);
    });

    it("publishes nothing while either habits query is still loading", () => {
      mockHabitsState.isLoading = true;

      const { rerender } = renderHook(() => useWidgetSync());
      expect(mockWidgets.writeHabitWidgetSnapshot).not.toHaveBeenCalled();

      mockHabitsState.isLoading = false;
      mockDailyHabitsState.isLoading = true;
      rerender({});

      expect(mockWidgets.writeHabitWidgetSnapshot).not.toHaveBeenCalled();
    });

    it("sends an empty payload when the habits feature is off", () => {
      // Not a skipped write — the switch can flip off after a snapshot was
      // published, and the widget would otherwise keep showing stale rings.
      mockHabitsEnabledState.enableHabits = false;
      mockHabitsState.habits = [habit()];

      renderHook(() => useWidgetSync());

      const [snapshot] = mockWidgets.writeHabitWidgetSnapshot.mock.calls[0] as [
        { days: { habits: unknown[] }[] },
      ];
      expect(snapshot.days.every((day) => day.habits.length === 0)).toBe(true);
    });

    it("does not republish habits when only the tasks changed", () => {
      // The two payloads meter separately — a task edit must not spend the
      // habit widget's reload budget, and vice versa.
      mockHabitsState.habits = [habit()];

      const { rerender } = renderHook(() => useWidgetSync());
      // Dated off the real clock — the payload only carries today +3 days, and
      // a fixed date could fall outside the window and leave it unchanged.
      mockTasksState.tasks = [task({ scheduledFor: TODAY })];
      rerender({});

      expect(mockWidgets.writeWidgetSnapshot).toHaveBeenCalledTimes(2);
      expect(mockWidgets.writeHabitWidgetSnapshot).toHaveBeenCalledTimes(1);
    });

    it("does not republish tasks when only a habit's progress changed", () => {
      mockHabitsState.habits = [habit()];

      const { rerender } = renderHook(() => useWidgetSync());
      mockDailyHabitsState.dailyHabits = [
        {
          date: TODAY,
          habitId: "habit-1",
          habits: habit(),
          percentComplete: 25,
          steps: 8,
          stepsComplete: 2,
        },
      ];
      rerender({});

      expect(mockWidgets.writeHabitWidgetSnapshot).toHaveBeenCalledTimes(2);
      expect(mockWidgets.writeWidgetSnapshot).toHaveBeenCalledTimes(1);
    });

    it("clears the habits payload and the pending queue on sign-out", () => {
      mockHabitsState.habits = [habit()];

      const { rerender } = renderHook(() => useWidgetSync());
      mockAuthState.session = null;
      rerender({});

      expect(mockWidgets.clearHabitWidgetSnapshot).toHaveBeenCalledTimes(1);
    });
  });
});
