import { Temporal } from "@js-temporal/polyfill";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import { makeOrFilter } from "@/api/applyFilters";
import {
  createTask,
  ETaskPriority,
  ETaskStatus,
  deleteTask,
  getTasks,
  hasOpenTaskForTemplate,
  TTask,
  updateTask,
  updateTasks,
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
  updateTasks: jest.fn(),
  deleteTask: jest.fn(),
  hasOpenTaskForTemplate: jest.fn(),
}));

const mockGetTasks = getTasks as jest.MockedFunction<typeof getTasks>;
const mockCreateTask = createTask as jest.MockedFunction<typeof createTask>;
const mockUpdateTask = updateTask as jest.MockedFunction<typeof updateTask>;
const mockUpdateTasks = updateTasks as jest.MockedFunction<typeof updateTasks>;
const mockDeleteTask = deleteTask as jest.MockedFunction<typeof deleteTask>;
const mockHasOpenTaskForTemplate =
  hasOpenTaskForTemplate as jest.MockedFunction<typeof hasOpenTaskForTemplate>;

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
    // The completing task is already terminal server-side by the time the
    // recurrence guard runs, so the default is "nothing else is open".
    mockHasOpenTaskForTemplate.mockResolvedValue(false);
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

  // The whole point of `isError`: react-query only serves `placeholderData`
  // while the query is pending, so on failure `tasks` falls back to `[]` and
  // `isLoading` reads `false` — indistinguishable from an empty account
  // without this flag (DEX-100).
  it("reports a failed fetch rather than an empty task list", async () => {
    const { wrapper } = createWrapper();
    mockGetTasks.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(result.current[1].isError).toBe(true));
    expect(result.current[0]).toEqual([]);
    expect(result.current[1].isLoading).toBe(false);
  });

  it("recovers from a failed fetch on refetch", async () => {
    const { wrapper } = createWrapper();
    mockGetTasks.mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current[1].isError).toBe(true));

    const task: TTask = {
      id: "task-1",
      alarmTime: null,
      title: "Recovered",
      dueOn: null,
      goalId: null,
      listId: null,
      priority: ETaskPriority.UNPRIORITIZED,
      scheduledFor: null,
      status: ETaskStatus.TODO,
      subtasks: [],
      templateId: null,
      url: null,
    };
    mockGetTasks.mockResolvedValue([task]);
    act(() => result.current[1].refetch());

    await waitFor(() => expect(result.current[0]).toEqual([task]));
    expect(result.current[1].isError).toBe(false);
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
      subtasks: [],
      templateId: null,
      url: null,
    };
    mockCreateTask.mockResolvedValue([task]);

    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(mockGetTasks).toHaveBeenCalledTimes(1));

    act(() => result.current[1].createTask({ title: "New task" }));

    await waitFor(() => expect(mockGetTasks).toHaveBeenCalledTimes(2));
  });

  describe("refetching after a mutation", () => {
    // `useRealtimeInvalidation` drops a remote `tasks` event outright while a
    // task mutation is in flight, and leans on the mutation to invalidate when
    // it settles. A create/delete that only invalidated on success would strand
    // another device's change made in that window.
    it("refetches even when a create fails", async () => {
      const { wrapper } = createWrapper();
      mockCreateTask.mockRejectedValue(new Error("offline"));

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() => expect(mockGetTasks).toHaveBeenCalledTimes(1));

      act(() => result.current[1].createTask({ title: "New task" }));

      await waitFor(() => expect(mockGetTasks).toHaveBeenCalledTimes(2));
    });

    it("refetches even when a delete fails", async () => {
      const { wrapper } = createWrapper();
      mockDeleteTask.mockRejectedValue(new Error("offline"));

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() => expect(mockGetTasks).toHaveBeenCalledTimes(1));

      act(() => result.current[1].deleteTask("task-1"));

      await waitFor(() => expect(mockGetTasks).toHaveBeenCalledTimes(2));
    });
  });

  describe("bulk updates share one key set", () => {
    const cached: TTask[] = [
      {
        id: "task-1",
        alarmTime: null,
        title: "Ship the release",
        dueOn: null,
        goalId: null,
        listId: "list-1",
        priority: ETaskPriority.NEITHER,
        scheduledFor: "2026-07-03",
        status: ETaskStatus.TODO,
        subtasks: [{ id: "sub-1", title: "Tag it", done: false }],
        templateId: null,
        url: null,
      },
      {
        id: "task-2",
        alarmTime: null,
        title: "Write the notes",
        dueOn: null,
        goalId: null,
        listId: "list-2",
        priority: ETaskPriority.NEITHER,
        scheduledFor: null,
        status: ETaskStatus.TODO,
        subtasks: [],
        templateId: null,
        url: null,
      },
    ];

    const bulkUpdate = async (diffs: Parameters<typeof updateTasks>[1]) => {
      const { wrapper, queryClient } = createWrapper();
      mockGetTasks.mockResolvedValue(cached);
      mockUpdateTasks.mockResolvedValue(cached);

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() =>
        expect(queryClient.getQueryData<TTask[]>(["tasks"])).toEqual(cached),
      );

      act(() => result.current[1].updateTasks(diffs));
      await waitFor(() => expect(mockUpdateTasks).toHaveBeenCalled());

      return mockUpdateTasks.mock.calls[0][1];
    };

    it("pads a swept key from the cache rather than nulling a not-null column", async () => {
      // Only task-1 has a checklist, so only it picks up `subtasks` from the
      // sweep — task-2 has to carry the key too, but as its stored value.
      const rows = await bulkUpdate([
        { id: "task-1", status: ETaskStatus.DONE },
        { id: "task-2", status: ETaskStatus.DONE },
      ]);

      expect(rows[1].subtasks).toEqual([]);
    });

    it("pads a missing key from the cache rather than clearing the column", async () => {
      // An upsert leaves an omitted column alone but overwrites on an explicit
      // null, so padding with null would edit rows the caller never touched.
      const rows = await bulkUpdate([
        { id: "task-1", scheduledFor: "2026-08-01" },
        { id: "task-2", listId: "list-9" },
      ]);

      expect(rows[0].listId).toBe("list-1");
      expect(rows[1].scheduledFor).toBeNull();
      expect(rows[1].listId).toBe("list-9");
    });

    it("leaves diffs that already share a key set untouched", async () => {
      const diffs = [
        { id: "task-1", listId: "list-9" },
        { id: "task-2", listId: "list-9" },
      ];

      expect(await bulkUpdate(diffs)).toEqual(diffs);
    });
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
      subtasks: [],
      templateId: "template-1",
      url: null,
    };
    const template: TTemplate = {
      id: "template-1",
      alarmTime: "17:30",
      createdAt: "2026-01-01T00:00:00Z",
      goalId: null,
      listId: null,
      priority: ETaskPriority.NEITHER,
      schedule: "0 0 * * *", // daily
      subtasks: [],
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

  // A repeat has exactly one open task. A template can gain a schedule after
  // the fact, which retroactively turns every task stamped from it into an
  // occurrence — completing three of them must not start three parallel chains.
  describe("the one-open-task guard on completion", () => {
    const template: TTemplate = {
      id: "template-1",
      alarmTime: null,
      createdAt: "2026-01-01T00:00:00Z",
      goalId: null,
      listId: null,
      priority: ETaskPriority.NEITHER,
      schedule: "0 0 * * *", // daily
      subtasks: [],
      title: "Take meds",
      userId: "user-1",
    };

    const completeLinkedTask = async () => {
      const { wrapper, queryClient } = createWrapper();
      const task: TTask = {
        id: "task-1",
        alarmTime: null,
        title: "Take meds",
        dueOn: null,
        goalId: null,
        listId: null,
        priority: ETaskPriority.NEITHER,
        scheduledFor: Temporal.Now.plainDateISO().toString(),
        status: ETaskStatus.TODO,
        subtasks: [],
        templateId: "template-1",
        url: null,
      };

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
    };

    it("spawns nothing when another open task already links to the template", async () => {
      mockHasOpenTaskForTemplate.mockResolvedValue(true);

      await completeLinkedTask();

      await waitFor(() =>
        expect(mockHasOpenTaskForTemplate).toHaveBeenCalledWith(
          expect.anything(),
          "template-1",
        ),
      );
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it("spawns the next occurrence when the completed task was the only open one", async () => {
      await completeLinkedTask();

      await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
      const [, created] = mockCreateTask.mock.calls[0];
      expect(created.templateId).toBe("template-1");
    });
  });

  describe("subtask sweep on completion", () => {
    const withSubtasks = (overrides: Partial<TTask> = {}): TTask => ({
      id: "task-1",
      alarmTime: null,
      title: "Ship the release",
      dueOn: null,
      goalId: null,
      listId: null,
      priority: ETaskPriority.NEITHER,
      scheduledFor: null,
      status: ETaskStatus.TODO,
      subtasks: [
        { id: "sub-1", title: "Tag it", done: false },
        { id: "sub-2", title: "Write notes", done: true },
      ],
      templateId: null,
      url: null,
      ...overrides,
    });

    const completeTask = async (task: TTask, status: ETaskStatus) => {
      const { wrapper, queryClient } = createWrapper();
      mockGetTasks.mockResolvedValue([task]);
      mockUpdateTask.mockResolvedValue([{ ...task, status }]);

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() =>
        expect(queryClient.getQueryData<TTask[]>(["tasks"])).toEqual([task]),
      );

      act(() => result.current[1].updateTask({ id: task.id, status }));
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());

      return mockUpdateTask.mock.calls[0][1];
    };

    it("closes every open subtask in the same update as the parent", async () => {
      const diff = await completeTask(withSubtasks(), ETaskStatus.DONE);

      // One row write carries both — that single-update property is what makes
      // the sweep atomic; a done parent is never briefly shown with open children.
      expect(diff.status).toBe(ETaskStatus.DONE);
      expect(diff.subtasks).toEqual([
        { id: "sub-1", title: "Tag it", done: true },
        { id: "sub-2", title: "Write notes", done: true },
      ]);
    });

    // DEX-153: with two states there is nowhere else for an abandoned or
    // handed-off parent's checklist to go — every terminal status checks it off.
    it.each([
      ["won't-do", ETaskStatus.WONT_DO],
      ["delegated", ETaskStatus.DELEGATED],
    ])("checks the list off for %s too, not just done", async (_l, status) => {
      const diff = await completeTask(withSubtasks(), status);

      expect(diff.subtasks?.every((subtask) => subtask.done)).toBe(true);
    });

    it("leaves the update untouched for a task with no subtasks", async () => {
      const diff = await completeTask(
        withSubtasks({ subtasks: [] }),
        ETaskStatus.DONE,
      );

      expect(diff).not.toHaveProperty("subtasks");
    });

    it("does not sweep when the update is not a completion", async () => {
      const diff = await completeTask(withSubtasks(), ETaskStatus.IN_PROGRESS);

      expect(diff).not.toHaveProperty("subtasks");
    });

    it("respects an explicitly supplied subtasks array over the sweep", async () => {
      // Editing a checklist item and completing the parent in one call must not
      // have the sweep clobber the caller's array.
      const { wrapper, queryClient } = createWrapper();
      const task = withSubtasks();
      const explicit = [{ id: "sub-1", title: "Renamed", done: false }];
      mockGetTasks.mockResolvedValue([task]);
      mockUpdateTask.mockResolvedValue([task]);

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() =>
        expect(queryClient.getQueryData<TTask[]>(["tasks"])).toEqual([task]),
      );

      act(() =>
        result.current[1].updateTask({
          id: "task-1",
          status: ETaskStatus.DONE,
          subtasks: explicit,
        }),
      );
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());

      expect(mockUpdateTask.mock.calls[0][1].subtasks).toEqual(explicit);
    });
  });

  it("materializes the template's checklist onto the next occurrence, unchecked", async () => {
    const { wrapper, queryClient } = createWrapper();
    const today = Temporal.Now.plainDateISO().toString();

    const task: TTask = {
      id: "task-1",
      alarmTime: null,
      title: "Weekly review",
      dueOn: null,
      goalId: null,
      listId: null,
      priority: ETaskPriority.NEITHER,
      scheduledFor: today,
      status: ETaskStatus.TODO,
      subtasks: [{ id: "sub-1", title: "Clear inbox", done: false }],
      templateId: "template-1",
      url: null,
    };
    const template: TTemplate = {
      id: "template-1",
      alarmTime: null,
      createdAt: "2026-01-01T00:00:00Z",
      goalId: null,
      listId: null,
      priority: ETaskPriority.NEITHER,
      schedule: "0 0 * * *",
      subtasks: [
        { id: "tpl-1", title: "Clear inbox" },
        { id: "tpl-2", title: "Review goals" },
      ],
      title: "Weekly review",
      userId: "user-1",
    };

    mockGetTasks.mockResolvedValue([task]);
    queryClient.setQueryData(["templates"], [template]);
    mockUpdateTask.mockResolvedValue([{ ...task, status: ETaskStatus.DONE }]);

    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() =>
      expect(queryClient.getQueryData<TTask[]>(["tasks"])).toEqual([task]),
    );

    act(() =>
      result.current[1].updateTask({ id: "task-1", status: ETaskStatus.DONE }),
    );

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    const [, created] = mockCreateTask.mock.calls[0];

    expect(created.subtasks?.map(({ title }) => title)).toEqual([
      "Clear inbox",
      "Review goals",
    ]);
    // The new occurrence starts fresh: unchecked, and not sharing ids with
    // either the template or the task that just completed.
    expect(created.subtasks?.every(({ done }) => done === false)).toBe(true);
    const ids = created.subtasks?.map(({ id }) => id) ?? [];
    expect(ids).not.toContain("tpl-1");
    expect(ids).not.toContain("sub-1");
  });

  describe("optimistic cache writes", () => {
    const cached: TTask = {
      id: "task-1",
      alarmTime: null,
      title: "Ship it",
      dueOn: null,
      goalId: null,
      listId: null,
      priority: ETaskPriority.NEITHER,
      scheduledFor: null,
      status: ETaskStatus.TODO,
      subtasks: [{ id: "s1", title: "Open", done: false }],
      templateId: null,
      url: null,
    };

    it("applies the diff to the cache before the request resolves", async () => {
      const { wrapper, queryClient } = createWrapper();
      mockGetTasks.mockResolvedValue([cached]);
      let resolve: ((value: TTask[]) => void) | undefined;
      mockUpdateTask.mockReturnValue(
        new Promise<TTask[]>((r) => {
          resolve = r;
        }),
      );

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() =>
        expect(queryClient.getQueryData<TTask[]>(["tasks"])).toEqual([cached]),
      );

      act(() =>
        result.current[1].updateTask({ id: "task-1", title: "Shipped" }),
      );

      // Visible immediately — this is what lets TaskCard compose its next edit
      // from stored state instead of a local overlay that can go stale.
      await waitFor(() =>
        expect(queryClient.getQueryData<TTask[]>(["tasks"])?.[0].title).toBe(
          "Shipped",
        ),
      );
      resolve?.([{ ...cached, title: "Shipped" }]);
    });

    it("does not write undefined over fields the diff omitted", async () => {
      const { wrapper, queryClient } = createWrapper();
      mockGetTasks.mockResolvedValue([cached]);
      mockUpdateTask.mockResolvedValue([cached]);

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() =>
        expect(queryClient.getQueryData<TTask[]>(["tasks"])).toEqual([cached]),
      );

      act(() =>
        result.current[1].updateTask({ id: "task-1", title: "Renamed" }),
      );

      const optimistic = queryClient.getQueryData<TTask[]>(["tasks"])?.[0];
      expect(optimistic?.subtasks).toEqual(cached.subtasks);
      expect(optimistic?.priority).toBe(ETaskPriority.NEITHER);
    });

    it("restores the snapshot when the write fails", async () => {
      const { wrapper, queryClient } = createWrapper();
      mockGetTasks.mockResolvedValue([cached]);
      mockUpdateTask.mockRejectedValue(new Error("offline"));

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() =>
        expect(queryClient.getQueryData<TTask[]>(["tasks"])).toEqual([cached]),
      );

      act(() =>
        result.current[1].updateTask({ id: "task-1", title: "Renamed" }),
      );

      // Without the rollback the card would keep showing unsaved state forever,
      // with no error surfaced anywhere.
      await waitFor(() =>
        expect(queryClient.getQueryData<TTask[]>(["tasks"])?.[0].title).toBe(
          "Ship it",
        ),
      );
    });

    it("still spawns a recurrence, despite the optimistic write marking the task complete", async () => {
      // The recurrence guard skips already-complete tasks; reading the live
      // cache after the optimistic write would see DONE and skip every time.
      const { wrapper, queryClient } = createWrapper();
      const today = Temporal.Now.plainDateISO().toString();
      const repeating: TTask = {
        ...cached,
        scheduledFor: today,
        subtasks: [],
        templateId: "template-1",
      };
      const template: TTemplate = {
        id: "template-1",
        alarmTime: null,
        createdAt: "2026-01-01T00:00:00Z",
        goalId: null,
        listId: null,
        priority: ETaskPriority.NEITHER,
        schedule: "0 0 * * *",
        subtasks: [],
        title: "Ship it",
        userId: "user-1",
      };

      mockGetTasks.mockResolvedValue([repeating]);
      queryClient.setQueryData(["templates"], [template]);
      mockUpdateTask.mockResolvedValue([
        { ...repeating, status: ETaskStatus.DONE },
      ]);

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() =>
        expect(queryClient.getQueryData<TTask[]>(["tasks"])).toEqual([
          repeating,
        ]),
      );

      act(() =>
        result.current[1].updateTask({
          id: "task-1",
          status: ETaskStatus.DONE,
        }),
      );

      await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    });
  });
});
