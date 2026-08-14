import { renderHook } from "@testing-library/react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { EThemeMode } from "@/api/preferences";

import { useWidgetSync } from "../useWidgetSync";

// Only the two side effects are mocked. `buildWidgetSnapshot` comes from the
// real module so these assertions run against a real payload — the point of the
// hook is *when* it publishes, and "when" is only meaningful if what it compares
// is the genuine article.
const mockWidgets = {
  writeWidgetSnapshot: jest.fn(),
  clearWidgetSnapshot: jest.fn(),
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
jest.mock("../usePreferences", () => ({
  useThemePreferences: () => mockThemeState,
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
    // `session` is null on every cold start until the stored one loads.
    // Clearing here would blank the widget on launch and repopulate it a beat
    // later — two reloads and a visible flash of the empty state.
    mockAuthState.session = null;
    mockAuthState.initializing = true;

    renderHook(() => useWidgetSync());

    expect(mockWidgets.clearWidgetSnapshot).not.toHaveBeenCalled();
    expect(mockWidgets.writeWidgetSnapshot).not.toHaveBeenCalled();
  });
});
