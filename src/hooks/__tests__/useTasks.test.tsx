import { Temporal } from "@js-temporal/polyfill";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import { makeOrFilter } from "@/api/applyFilters";
import {
  createTask,
  deleteTask,
  ETaskPriority,
  ETaskStatus,
  getTasks,
  TTask,
  updateTask,
} from "@/api/tasks";
import { TTemplate } from "@/api/templates";

import { canonicalTaskFilters, useTasks } from "../useTasks";

// useTasks imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/api/tasks", () => ({
  ...jest.requireActual<typeof import("@/api/tasks")>("@/api/tasks"),
  getTasks: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
}));

const mockGetTasks = getTasks as jest.MockedFunction<typeof getTasks>;
const mockCreateTask = createTask as jest.MockedFunction<typeof createTask>;
const mockUpdateTask = updateTask as jest.MockedFunction<typeof updateTask>;
const mockDeleteTask = deleteTask as jest.MockedFunction<typeof deleteTask>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

describe("canonicalTaskFilters", () => {
  it("combines incomplete status with the recent-window date scope in one OR filter", () => {
    const cutoff = Temporal.Now.plainDateISO().subtract({ days: 30 });

    expect(canonicalTaskFilters()).toEqual([
      makeOrFilter([
        ["status", "in", [ETaskStatus.TODO, ETaskStatus.IN_PROGRESS]],
        ["scheduledFor", "gte", cutoff.toString()],
      ]),
    ]);
  });
});

describe("useTasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTasks.mockResolvedValue([]);
  });

  it("fetches under a single stable query key, not one per caller", async () => {
    const { wrapper, queryClient } = createWrapper();

    renderHook(() => useTasks(), { wrapper });
    renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(mockGetTasks).toHaveBeenCalledTimes(1));
    expect(
      queryClient.getQueryCache().findAll({ queryKey: ["tasks"] }),
    ).toHaveLength(1);
  });

  it("fetches with the canonical task filters", async () => {
    const { wrapper } = createWrapper();

    renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(mockGetTasks).toHaveBeenCalled());

    const [, filters] = mockGetTasks.mock.calls[0];
    expect(filters).toEqual(canonicalTaskFilters());
  });

  it("refetches the single canonical query after a mutation", async () => {
    const { wrapper } = createWrapper();
    const task: TTask = {
      id: "task-1",
      alarmTime: null,
      title: "New task",
      dueOn: null,
      goalId: null,
      listId: null,
      priority: ETaskPriority.UNPRIORITIZED,
      scheduledFor: null,
      status: ETaskStatus.TODO,
      templateId: null,
    };
    mockCreateTask.mockResolvedValue([task]);

    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(mockGetTasks).toHaveBeenCalledTimes(1));

    act(() => result.current[1].createTask({ title: "New task" }));

    await waitFor(() => expect(mockGetTasks).toHaveBeenCalledTimes(2));
  });

  it("carries the template's alarm time onto the next recurring occurrence", async () => {
    const { wrapper, queryClient } = createWrapper();
    const today = Temporal.Now.plainDateISO().toString();

    const task: TTask = {
      id: "task-1",
      alarmTime: "17:30",
      title: "Take meds",
      dueOn: null,
      goalId: null,
      listId: null,
      priority: ETaskPriority.NEITHER,
      scheduledFor: today,
      status: ETaskStatus.TODO,
      templateId: "template-1",
    };
    const template: TTemplate = {
      id: "template-1",
      alarmTime: "17:30",
      createdAt: "2026-01-01T00:00:00Z",
      goalId: null,
      listId: null,
      priority: ETaskPriority.NEITHER,
      schedule: "0 0 * * *", // daily
      title: "Take meds",
      userId: "user-1",
    };

    // Seed both caches so the recurrence helper reads them synchronously (the
    // template cache also short-circuits its getTemplates fallback fetch).
    mockGetTasks.mockResolvedValue([task]);
    queryClient.setQueryData(["templates"], [template]);
    mockUpdateTask.mockResolvedValue([{ ...task, status: ETaskStatus.DONE }]);

    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() =>
      expect(queryClient.getQueryData<TTask[]>(["tasks"])).toEqual([task]),
    );

    act(() =>
      result.current[1].updateTask({
        id: "task-1",
        status: ETaskStatus.DONE,
      }),
    );

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    const [, created] = mockCreateTask.mock.calls[0];
    expect(created.alarmTime).toBe("17:30");
    expect(created.templateId).toBe("template-1");
    expect(created.scheduledFor).not.toBe(today);
  });

  // Drag-to-schedule (DEX-77) made update latency visible — a dropped card sat
  // in the backlog until the refetch resolved.
  describe("optimistic updates", () => {
    const backlogTask: TTask = {
      id: "task-1",
      alarmTime: null,
      title: "Write report",
      dueOn: null,
      goalId: null,
      listId: null,
      priority: ETaskPriority.UNPRIORITIZED,
      scheduledFor: null,
      status: ETaskStatus.TODO,
      templateId: null,
    };

    /** Renders the hook with `tasks` already in the canonical cache. */
    const seeded = async (tasks: TTask[] = [backlogTask]) => {
      const { wrapper, queryClient } = createWrapper();
      mockGetTasks.mockResolvedValue(tasks);
      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() =>
        expect(queryClient.getQueryData<TTask[]>(["tasks"])).toEqual(tasks),
      );
      return { queryClient, result };
    };

    const cached = (queryClient: QueryClient) =>
      queryClient.getQueryData<TTask[]>(["tasks"]) ?? [];

    const cachedTask = (queryClient: QueryClient) => cached(queryClient)[0];

    /**
     * Holds the update in flight so the cache can be read between `onMutate`
     * and `onSettled`. Every hold is released in `afterEach` — a mutation left
     * pending forever wedges the whole run, not just its test.
     */
    const releases: ((tasks: TTask[]) => void)[] = [];
    const holdUpdate = () =>
      // `mockImplementation`, not `mockReturnValue`: each call gets its own
      // promise and its own resolver, so a test can hold two updates in flight
      // independently instead of sharing one settle.
      mockUpdateTask.mockImplementation(
        () => new Promise<TTask[]>((resolve) => releases.push(resolve)),
      );

    afterEach(async () => {
      await act(async () =>
        releases.splice(0).forEach((release) => release([])),
      );
    });

    it("applies the change to the cache before the request resolves", async () => {
      const { queryClient, result } = await seeded();
      holdUpdate();

      await act(async () => {
        result.current[1].updateTask({
          id: "task-1",
          scheduledFor: "2026-07-20",
        });
      });

      // Only `onMutate` can have moved the cache — the request is still open.
      expect(cachedTask(queryClient)).toEqual({
        ...backlogTask,
        scheduledFor: "2026-07-20",
      });
    });

    it("rolls back when the save fails", async () => {
      const { queryClient, result } = await seeded();
      mockUpdateTask.mockRejectedValue(new Error("network down"));

      await act(async () => {
        result.current[1].updateTask({
          id: "task-1",
          scheduledFor: "2026-07-20",
        });
      });

      await waitFor(() =>
        expect(cachedTask(queryClient)?.scheduledFor).toBeNull(),
      );
    });

    // The cache mirrors getTasks' status/priority/due_on ordering, so a card
    // that changes position has to move immediately rather than jumping when
    // the refetch lands.
    it("re-sorts the cache when the change moves the task", async () => {
      const urgent = { ...backlogTask, id: "urgent", priority: 1 };
      const { queryClient, result } = await seeded([
        urgent,
        { ...backlogTask, id: "later" },
      ]);
      holdUpdate();

      await act(async () => {
        result.current[1].updateTask({ id: "later", priority: 0 });
      });

      expect(cached(queryClient).map(({ id }) => id)).toEqual([
        "later",
        "urgent",
      ]);
    });

    // A whole-array rollback would also revert the other task's in-flight
    // optimistic write.
    it("rolls back only the failed task, not concurrent optimistic writes", async () => {
      const other = { ...backlogTask, id: "task-2" };
      const { queryClient, result } = await seeded([backlogTask, other]);
      // task-2 stays in flight throughout, so its optimistic write can only be
      // undone by task-1's rollback — not by a refetch that task-2 settling
      // would trigger.
      let failFirst!: (error: Error) => void;
      mockUpdateTask.mockImplementation((_supabase, diff) =>
        diff.id === "task-1"
          ? new Promise<TTask[]>((_resolve, reject) => {
              failFirst = reject;
            })
          : new Promise<TTask[]>((resolve) => releases.push(resolve)),
      );

      await act(async () => {
        result.current[1].updateTask({
          id: "task-2",
          scheduledFor: "2026-08-01",
        });
        result.current[1].updateTask({
          id: "task-1",
          scheduledFor: "2026-07-20",
        });
      });
      await act(async () => failFirst(new Error("network down")));

      const byId = Object.fromEntries(
        cached(queryClient).map((entry) => [entry.id, entry.scheduledFor]),
      );
      expect(byId["task-1"]).toBeNull();
      expect(byId["task-2"]).toBe("2026-08-01");
    });

    // Every task mutation shares the invalidation gate, not just update: a
    // delete landing mid-drag invalidates the same query, and an ungated
    // refetch would return server state without the still-open edit.
    it("does not refetch over an in-flight update when a delete settles", async () => {
      const { queryClient, result } = await seeded();
      holdUpdate();
      mockDeleteTask.mockResolvedValue(undefined);
      mockGetTasks.mockClear();

      await act(async () => {
        result.current[1].updateTask({
          id: "task-1",
          scheduledFor: "2026-07-20",
        });
      });
      await act(async () => {
        result.current[1].deleteTask("task-2");
      });

      expect(mockGetTasks).not.toHaveBeenCalled();
      expect(cachedTask(queryClient)?.scheduledFor).toBe("2026-07-20");
    });

    // api/tasks builds its wire payload separately, so an undefined here would
    // corrupt only the cache — and slip past `!== null` render guards.
    it("ignores keys whose value is undefined", async () => {
      const withList = { ...backlogTask, listId: "list-1" };
      const { queryClient, result } = await seeded([withList]);
      holdUpdate();

      await act(async () => {
        result.current[1].updateTask({ id: "task-1", listId: undefined });
      });

      expect(cachedTask(queryClient)?.listId).toBe("list-1");
    });
  });
});
