import { Temporal } from "@js-temporal/polyfill";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import { makeOrFilter } from "@/api/applyFilters";
import {
  createTask,
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
}));

const mockGetTasks = getTasks as jest.MockedFunction<typeof getTasks>;
const mockCreateTask = createTask as jest.MockedFunction<typeof createTask>;
const mockUpdateTask = updateTask as jest.MockedFunction<typeof updateTask>;

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

    /** Renders the hook with `backlogTask` already in the canonical cache. */
    const seeded = async () => {
      const { wrapper, queryClient } = createWrapper();
      mockGetTasks.mockResolvedValue([backlogTask]);
      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() =>
        expect(queryClient.getQueryData<TTask[]>(["tasks"])).toEqual([
          backlogTask,
        ]),
      );
      return { queryClient, result };
    };

    const cachedTask = (queryClient: QueryClient) =>
      queryClient.getQueryData<TTask[]>(["tasks"])?.[0];

    it("applies the change to the cache before the request resolves", async () => {
      const { queryClient, result } = await seeded();
      // Held in flight so the cache can be read between onMutate and
      // onSettled; released below, since a forever-pending mutation wedges
      // the run.
      let release!: (tasks: TTask[]) => void;
      mockUpdateTask.mockReturnValue(
        new Promise<TTask[]>((resolve) => {
          release = resolve;
        }),
      );

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

      await act(async () => {
        release([{ ...backlogTask, scheduledFor: "2026-07-20" }]);
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
  });
});
