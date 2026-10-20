import { act, render } from "@testing-library/react-native";
import * as AppIntents from "expo-app-intents";

import type { AppIntentInvocation } from "expo-app-intents";

import { ETaskStatus, TCreateTask, TTask, TUpdateTask } from "@/api/tasks";
import type { THabit } from "@/api/habits";
import type { TList } from "@/api/lists";
import type { useHabits } from "@/hooks/useHabits";
import type { useLists } from "@/hooks/useLists";
import type { useTasks } from "@/hooks/useTasks";
import { AppIntentBridge } from "../AppIntentBridge";

// The native App Intents module does not exist under Jest, so every call is a
// spy and delivery is driven by invoking the handler useAppIntents received.

const mockCreateTask = jest.fn(
  (_task: TCreateTask, callbacks?: { onSuccess?: () => void }) => {
    callbacks?.onSuccess?.();
  },
);
const mockUpdateTask = jest.fn(
  (_diff: TUpdateTask, callbacks?: { onSuccess?: () => void }) => {
    callbacks?.onSuccess?.();
  },
);

// The hooks' return tuples are built through these helpers so the mocked
// shape always satisfies the real TUseTasks/TUseHabits/TUseLists types.
type TUseTasksResult = ReturnType<typeof useTasks>;
type TUseHabitsResult = ReturnType<typeof useHabits>;
type TUseListsResult = ReturnType<typeof useLists>;

const tasksResult = (
  tasks: TTask[],
  status: { isError?: boolean; isLoading?: boolean } = {},
): TUseTasksResult => [
  tasks,
  {
    createTask: mockCreateTask,
    deleteTask: jest.fn(),
    isError: status.isError ?? false,
    isLoading: status.isLoading ?? false,
    refetch: jest.fn(),
    updateTask: mockUpdateTask,
    updateTasks: jest.fn(),
  },
];

const habitsResult = (
  habits: THabit[],
  isLoading = false,
): TUseHabitsResult => [
  habits,
  {
    createHabit: jest.fn(),
    deleteHabit: jest.fn(),
    getHabitById: jest.fn(),
    isLoading,
    updateHabit: jest.fn(),
  },
];

const listsResult = (lists: TList[], isLoading = false): TUseListsResult => [
  lists,
  {
    createList: jest.fn(),
    deleteList: jest.fn(),
    getListById: jest.fn(),
    isLoading,
    updateList: jest.fn(),
  },
];

const mockUseTasks = jest.fn<TUseTasksResult, []>(() => tasksResult([]));
const mockUseHabits = jest.fn<TUseHabitsResult, []>(() => habitsResult([]));
const mockUseLists = jest.fn<TUseListsResult, []>(() => listsResult([]));

type TAuth = {
  initializing: boolean;
  session: { user: { id: string } } | null;
};
let mockAuth: TAuth = {
  initializing: false,
  session: { user: { id: "user-1" } },
};
const mockUseAuth = jest.fn(() => mockAuth);

jest.mock("@/hooks/useAuth", () => ({
  supabase: {},
  useAuth: () => mockUseAuth(),
}));
jest.mock("@/hooks/useTasks", () => ({ useTasks: () => mockUseTasks() }));
jest.mock("@/hooks/useHabits", () => ({ useHabits: () => mockUseHabits() }));
jest.mock("@/hooks/useLists", () => ({ useLists: () => mockUseLists() }));

const mockHandler = jest.fn();
const mockGetPending = jest.fn();
jest.mock("expo-app-intents", () => ({
  useAppIntents: (handler: unknown) => mockHandler(handler),
  getPendingInvocationsAsync: () => mockGetPending(),
  removePendingInvocationAsync: jest.fn().mockResolvedValue(undefined),
  clearPendingInvocationsAsync: jest.fn().mockResolvedValue(undefined),
  setEntityCatalogAsync: jest.fn().mockResolvedValue(undefined),
  deleteDonationsAsync: jest.fn().mockResolvedValue([]),
}));

const invocation = (
  overrides: Partial<AppIntentInvocation>,
): AppIntentInvocation => ({
  createdAt: 0,
  id: "inv-1",
  name: "addTask",
  params: { title: "Buy milk" },
  ...overrides,
});

// The handler useAppIntents received — delivering through it is the only way
// an invocation reaches the bridge.
const deliver = async (pending: AppIntentInvocation[]) => {
  const handler = mockHandler.mock.calls.at(-1)?.[0] as
    ((pending: AppIntentInvocation[]) => Promise<void> | void) | undefined;
  await act(async () => {
    await handler?.(pending);
  });
};

const removeSpy = AppIntents.removePendingInvocationAsync as jest.Mock;
const setCatalogSpy = AppIntents.setEntityCatalogAsync as jest.Mock;

describe("AppIntentBridge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = { initializing: false, session: { user: { id: "user-1" } } };
    mockCreateTask.mockImplementation((_task, callbacks) =>
      callbacks?.onSuccess?.(),
    );
    mockUpdateTask.mockImplementation((_diff, callbacks) =>
      callbacks?.onSuccess?.(),
    );
    mockUseTasks.mockReturnValue(tasksResult([]));
    mockUseHabits.mockReturnValue(habitsResult([]));
    mockUseLists.mockReturnValue(listsResult([]));
    mockGetPending.mockResolvedValue([]);
  });

  it("applies an addTask invocation through the createTask mutation and removes it", async () => {
    await render(<AppIntentBridge />);

    await deliver([
      invocation({ name: "addTask", params: { title: "Buy milk" } }),
    ]);

    expect(mockCreateTask).toHaveBeenCalledWith(
      { title: "Buy milk", listId: null, dueOn: null },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(removeSpy).toHaveBeenCalledWith("inv-1");
  });

  it("maps the optional list and due date from the invocation", async () => {
    await render(<AppIntentBridge />);

    await deliver([
      invocation({
        name: "addTask",
        params: { title: "Ship it", listId: "list-1", dueDate: "2026-11-01" },
      }),
    ]);

    expect(mockCreateTask).toHaveBeenCalledWith(
      { title: "Ship it", listId: "list-1", dueOn: "2026-11-01" },
      expect.anything(),
    );
  });

  it("drops an addTask invocation with no title", async () => {
    await render(<AppIntentBridge />);

    await deliver([invocation({ name: "addTask", params: {} })]);

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith("inv-1");
  });

  it("completes a task with status DONE through the updateTask mutation", async () => {
    await render(<AppIntentBridge />);

    await deliver([
      invocation({ name: "completeTask", params: { taskId: "task-9" } }),
    ]);

    expect(mockUpdateTask).toHaveBeenCalledWith(
      { id: "task-9", status: ETaskStatus.DONE },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(removeSpy).toHaveBeenCalledWith("inv-1");
  });

  it("applies a duplicate delivery of the same invocation id exactly once", async () => {
    await render(<AppIntentBridge />);

    await deliver([invocation({})]);
    await deliver([invocation({})]);

    expect(mockCreateTask).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it("leaves an unknown intent queued as a no-op", async () => {
    await render(<AppIntentBridge />);

    await deliver([invocation({ name: "mysteryIntent" })]);

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith("inv-1");
  });

  it("keeps invocations queued while signed out", async () => {
    mockAuth = { initializing: false, session: null };

    await render(<AppIntentBridge />);

    await deliver([invocation({})]);

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("waits for the task query to settle before completing a task", async () => {
    mockUseTasks.mockReturnValue(tasksResult([], { isLoading: true }));
    await render(<AppIntentBridge />);

    await deliver([
      invocation({ name: "completeTask", params: { taskId: "task-9" } }),
    ]);

    // Not settled: left queued, nothing written, nothing removed.
    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();

    // The query settles; the drain effect re-reads the queue and applies it.
    mockUseTasks.mockReturnValue(tasksResult([]));
    mockGetPending.mockResolvedValue([
      invocation({ name: "completeTask", params: { taskId: "task-9" } }),
    ]);
    await render(<AppIntentBridge />);

    expect(mockUpdateTask).toHaveBeenCalledWith(
      { id: "task-9", status: ETaskStatus.DONE },
      expect.anything(),
    );
    expect(removeSpy).toHaveBeenCalledWith("inv-1");
  });

  it("publishes the task, habit, and list catalogs from the loaded queries", async () => {
    const task: TTask = {
      id: "task-1",
      alarmTime: null,
      dueOn: null,
      goalId: null,
      listId: "list-1",
      priority: 0,
      scheduledFor: "2026-10-20T09:00:00.000Z",
      status: ETaskStatus.TODO,
      subtasks: [],
      templateId: null,
      title: "Write report",
      url: null,
    };
    mockUseTasks.mockReturnValue(tasksResult([task]));
    mockUseLists.mockReturnValue(
      listsResult([
        {
          createdAt: "",
          emoji: "📁",
          id: "list-1",
          isArchived: false,
          title: "Work",
        },
      ]),
    );
    mockUseHabits.mockReturnValue(
      habitsResult([
        {
          daysActive: [1, 2, 3, 4, 5],
          emoji: "🏃",
          id: "habit-1",
          isArchived: false,
          isPaused: false,
          steps: 3,
          title: "Run",
        },
      ]),
    );

    await render(<AppIntentBridge />);

    expect(setCatalogSpy).toHaveBeenCalledWith("task", [
      { id: "task-1", title: "Write report", subtitle: "Work" },
    ]);
    expect(setCatalogSpy).toHaveBeenCalledWith("habit", [
      { id: "habit-1", title: "Run", subtitle: "🏃" },
    ]);
    expect(setCatalogSpy).toHaveBeenCalledWith("list", [
      { id: "list-1", title: "Work", subtitle: "📁" },
    ]);
  });

  it("does not publish an empty catalog before the queries have loaded", async () => {
    mockUseTasks.mockReturnValue(tasksResult([], { isLoading: true }));
    mockUseHabits.mockReturnValue(habitsResult([], true));
    mockUseLists.mockReturnValue(listsResult([], true));

    await render(<AppIntentBridge />);

    expect(setCatalogSpy).not.toHaveBeenCalled();
  });

  it("clears catalogs, donations, and the invocation queue on sign-out", async () => {
    const { rerender, unmount } = await render(<AppIntentBridge />);

    // Sign-out transition on the same instance (a fresh mount with no session
    // is a cold start, which must not clear the queue).
    mockAuth = { initializing: false, session: null };
    await rerender(<AppIntentBridge />);

    expect(AppIntents.setEntityCatalogAsync).toHaveBeenCalledWith("task", []);
    expect(AppIntents.setEntityCatalogAsync).toHaveBeenCalledWith("habit", []);
    expect(AppIntents.setEntityCatalogAsync).toHaveBeenCalledWith("list", []);
    expect(AppIntents.deleteDonationsAsync).toHaveBeenCalledWith({
      intent: "addTask",
    });
    expect(AppIntents.deleteDonationsAsync).toHaveBeenCalledWith({
      intent: "completeTask",
    });
    expect(AppIntents.clearPendingInvocationsAsync).toHaveBeenCalled();
    await unmount();
  });

  it("does not clear the invocation queue on a signed-out cold start", async () => {
    mockAuth = { initializing: false, session: null };

    await render(<AppIntentBridge />);

    expect(AppIntents.clearPendingInvocationsAsync).not.toHaveBeenCalled();
    expect(AppIntents.setEntityCatalogAsync).toHaveBeenCalledWith("task", []);
  });
});
