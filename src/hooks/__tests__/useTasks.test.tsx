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
} from "@/api/tasks";

import { canonicalTaskFilters, useTasks } from "../useTasks";

// useTasks imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/api/tasks", () => ({
  ...jest.requireActual<typeof import("@/api/tasks")>("@/api/tasks"),
  getTasks: jest.fn(),
  createTask: jest.fn(),
}));

const mockGetTasks = getTasks as jest.MockedFunction<typeof getTasks>;
const mockCreateTask = createTask as jest.MockedFunction<typeof createTask>;

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
});
