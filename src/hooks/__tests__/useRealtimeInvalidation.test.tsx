import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import * as journalsApi from "@/api/journals";
import * as notesApi from "@/api/notes";
import * as tasksApi from "@/api/tasks";
import { useJournals } from "@/hooks/useJournals";
import { useNotes } from "@/hooks/useNotes";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";

import {
  REALTIME_INVALIDATIONS,
  useRealtimeInvalidation,
} from "../useRealtimeInvalidation";

type ChangeHandler = (payload: { table: string }) => void;
type StatusHandler = (status: string) => void;

type CapturedChannel = {
  bindings: { table: string; filter: string; handler: ChangeHandler }[];
  statusHandler?: StatusHandler;
};

let captured: CapturedChannel | undefined;
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();

jest.mock("@/hooks/useAuth", () => ({
  supabase: {
    // Wrapped, not a direct `channel: mockChannel` reference — jest hoists this
    // factory above the const, so a direct reference would capture it too early.
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/api/notes", () => ({ getNote: jest.fn(), upsertNote: jest.fn() }));
jest.mock("@/api/journals", () => ({
  getJournal: jest.fn(),
  upsertJournal: jest.fn(),
}));
// Only the request functions — `ETaskStatus` and the subtask helpers are real,
// since `useTasks` reads them while composing a write.
jest.mock("@/api/tasks", () => ({
  ...jest.requireActual("@/api/tasks"),
  getTasks: jest.fn(),
  updateTask: jest.fn(),
}));

const mockGetNote = notesApi.getNote as jest.MockedFunction<
  typeof notesApi.getNote
>;
const mockUpsertNote = notesApi.upsertNote as jest.MockedFunction<
  typeof notesApi.upsertNote
>;
const mockGetJournal = journalsApi.getJournal as jest.MockedFunction<
  typeof journalsApi.getJournal
>;
const mockUpsertJournal = journalsApi.upsertJournal as jest.MockedFunction<
  typeof journalsApi.upsertJournal
>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockGetTasks = tasksApi.getTasks as jest.MockedFunction<
  typeof tasksApi.getTasks
>;
const mockUpdateTask = tasksApi.updateTask as jest.MockedFunction<
  typeof tasksApi.updateTask
>;

const makeChannel = () => {
  const channel: {
    on: (
      type: string,
      config: { table: string; filter: string },
      handler: ChangeHandler,
    ) => typeof channel;
    subscribe: (handler: StatusHandler) => typeof channel;
  } = {
    on: (_type, config, handler) => {
      captured!.bindings.push({ ...config, handler });
      return channel;
    },
    subscribe: (handler) => {
      captured!.statusHandler = handler;
      return channel;
    },
  };
  return channel;
};

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

describe("useRealtimeInvalidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    captured = { bindings: [] };
    mockChannel.mockImplementation(() => makeChannel());
  });

  it("does not open a channel while signed out", () => {
    const { wrapper } = createWrapper();

    renderHook(() => useRealtimeInvalidation(undefined), { wrapper });

    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("subscribes to every mapped table scoped to the user", () => {
    const { wrapper } = createWrapper();

    renderHook(() => useRealtimeInvalidation("user-1"), { wrapper });

    expect(mockChannel).toHaveBeenCalledWith("invalidations:user-1");
    const tables = Object.keys(REALTIME_INVALIDATIONS);
    expect(captured!.bindings).toHaveLength(tables.length);
    tables.forEach((table) => {
      expect(captured!.bindings).toContainEqual(
        expect.objectContaining({ table, filter: "user_id=eq.user-1" }),
      );
    });
  });

  it("invalidates the mapped key for a single-table event after the flush window", () => {
    jest.useFakeTimers();
    try {
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      renderHook(() => useRealtimeInvalidation("user-1"), { wrapper });

      const binding = captured!.bindings.find((b) => b.table === "tasks")!;
      act(() => binding.handler({ table: "tasks" }));
      expect(invalidateSpy).not.toHaveBeenCalled();

      act(() => jest.advanceTimersByTime(250));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tasks"] });
    } finally {
      jest.useRealTimers();
    }
  });

  it("invalidates both mapped keys for a habits event", () => {
    jest.useFakeTimers();
    try {
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      renderHook(() => useRealtimeInvalidation("user-1"), { wrapper });

      const binding = captured!.bindings.find((b) => b.table === "habits")!;
      act(() => binding.handler({ table: "habits" }));
      act(() => jest.advanceTimersByTime(250));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["habits"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dailyHabits"] });
    } finally {
      jest.useRealTimers();
    }
  });

  it("coalesces a burst of events for one table into a single invalidation", () => {
    jest.useFakeTimers();
    try {
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      renderHook(() => useRealtimeInvalidation("user-1"), { wrapper });

      const binding = captured!.bindings.find((b) => b.table === "tasks")!;
      act(() => {
        binding.handler({ table: "tasks" });
        binding.handler({ table: "tasks" });
        binding.handler({ table: "tasks" });
      });
      act(() => jest.advanceTimersByTime(250));

      // "One call per key the table maps to", not a literal 1, so adding a key
      // (as DEX-47's ["search"] did) doesn't read as a coalescing regression.
      expect(invalidateSpy).toHaveBeenCalledTimes(
        REALTIME_INVALIDATIONS.tasks.length,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("invalidates search alongside each of the three searchable tables", () => {
    jest.useFakeTimers();
    try {
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      renderHook(() => useRealtimeInvalidation("user-1"), { wrapper });

      // An open results list must not keep showing a note that has since been
      // edited away, or miss a task that now matches (DEX-47).
      for (const table of ["tasks", "notes", "journals"]) {
        const binding = captured!.bindings.find((b) => b.table === table)!;
        act(() => binding.handler({ table }));
        act(() => jest.advanceTimersByTime(250));

        // Exact match pins that no predicate rides along — the per-date guard
        // reads queryKey[1] as a date, which for ["search", query] is the query.
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["search"] });
        invalidateSpy.mockClear();
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it("skips refetching a date's notes query while its own autosave is in flight, then catches up once it settles", async () => {
    jest.useFakeTimers();
    try {
      const { wrapper } = createWrapper();
      renderHook(() => useRealtimeInvalidation("user-1"), { wrapper });

      let resolveUpsert: () => void = () => {};
      mockGetNote.mockResolvedValue(null);
      mockUpsertNote.mockReturnValue(
        new Promise((resolve) => {
          resolveUpsert = () => resolve({ date: "2026-07-12", content: "hi" });
        }),
      );

      const notes = renderHook(() => useNotes("2026-07-12"), { wrapper });
      await waitFor(() =>
        expect(notes.result.current[1].isLoading).toBe(false),
      );
      // The initial mount already fetched this date once.
      const fetchCountBeforeEvent = mockGetNote.mock.calls.length;
      act(() => notes.result.current[1].upsertNote({ content: "hi" }));
      await waitFor(() => expect(mockUpsertNote.mock.calls.length).toBe(1));

      const binding = captured!.bindings.find((b) => b.table === "notes")!;
      act(() => binding.handler({ table: "notes" }));
      act(() => jest.advanceTimersByTime(250));

      // Still mid-autosave for this exact date — no extra refetch yet.
      expect(mockGetNote.mock.calls.length).toBe(fetchCountBeforeEvent);

      act(() => resolveUpsert());
      await waitFor(() => expect(notes.result.current[0].content).toBe("hi"));

      act(() => binding.handler({ table: "notes" }));
      act(() => jest.advanceTimersByTime(250));

      // The autosave has settled — the same date now refetches normally.
      await waitFor(() =>
        expect(mockGetNote.mock.calls.length).toBeGreaterThan(
          fetchCountBeforeEvent,
        ),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("applies the same in-flight guard to the journals table", async () => {
    jest.useFakeTimers();
    try {
      const { wrapper } = createWrapper();
      renderHook(() => useRealtimeInvalidation("user-1"), { wrapper });

      let resolveUpsert: () => void = () => {};
      mockGetJournal.mockResolvedValue(null);
      mockUpsertJournal.mockReturnValue(
        new Promise((resolve) => {
          resolveUpsert = () =>
            resolve({ date: "2026-07-12", prompts: [], mood: null });
        }),
      );
      mockUsePreferences.mockReturnValue([
        { templatePrompts: [] } as never,
        { updatePreferences: jest.fn() },
      ]);

      const journals = renderHook(() => useJournals("2026-07-12"), { wrapper });
      await waitFor(() =>
        expect(journals.result.current[1].isLoading).toBe(false),
      );
      const fetchCountBeforeEvent = mockGetJournal.mock.calls.length;
      act(() => journals.result.current[1].upsertJournal({ prompts: [] }));
      await waitFor(() => expect(mockUpsertJournal.mock.calls.length).toBe(1));

      const binding = captured!.bindings.find((b) => b.table === "journals")!;
      act(() => binding.handler({ table: "journals" }));
      act(() => jest.advanceTimersByTime(250));

      expect(mockGetJournal.mock.calls.length).toBe(fetchCountBeforeEvent);

      act(() => resolveUpsert());
      await waitFor(() => expect(journals.result.current[1].exists).toBe(true));

      act(() => binding.handler({ table: "journals" }));
      act(() => jest.advanceTimersByTime(250));

      await waitFor(() =>
        expect(mockGetJournal.mock.calls.length).toBeGreaterThan(
          fetchCountBeforeEvent,
        ),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("skips refetching tasks while one of our own writes is in flight, then catches up once it settles", async () => {
    jest.useFakeTimers();
    try {
      const { wrapper, queryClient } = createWrapper();
      renderHook(() => useRealtimeInvalidation("user-1"), { wrapper });

      let resolveUpdate: () => void = () => {};
      mockGetTasks.mockResolvedValue([]);
      mockUpdateTask.mockReturnValue(
        new Promise((resolve) => {
          resolveUpdate = () => resolve([]);
        }),
      );

      const tasks = renderHook(() => useTasks(), { wrapper });
      await waitFor(() =>
        expect(tasks.result.current[1].isLoading).toBe(false),
      );
      // The initial mount already fetched once.
      const fetchCountBeforeEvent = mockGetTasks.mock.calls.length;

      act(() =>
        tasks.result.current[1].updateTask({ id: "task-1", title: "Renamed" }),
      );
      await waitFor(() => expect(mockUpdateTask.mock.calls.length).toBe(1));

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      const binding = captured!.bindings.find((b) => b.table === "tasks")!;
      act(() => binding.handler({ table: "tasks" }));
      act(() => jest.advanceTimersByTime(250));

      // Postgres echoing our own write back must not start a refetch: it can
      // resolve after a *newer* local edit and stamp stale rows over it.
      expect(mockGetTasks.mock.calls.length).toBe(fetchCountBeforeEvent);
      // ...but scoped to ["tasks"] only — ["search"] has no optimistic cache to
      // protect, so suppressing it here would leave a stale card on Search.
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["search"] }),
      );
      expect(invalidateSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["tasks"] }),
      );

      act(() => resolveUpdate());

      // Nothing is lost by skipping — the write's own settle invalidation is
      // the catch-up for anything that genuinely changed elsewhere.
      await waitFor(() =>
        expect(mockGetTasks.mock.calls.length).toBeGreaterThan(
          fetchCountBeforeEvent,
        ),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not suppress invalidation of an unrelated date while another date's autosave is in flight", async () => {
    jest.useFakeTimers();
    try {
      const { wrapper } = createWrapper();
      renderHook(() => useRealtimeInvalidation("user-1"), { wrapper });

      mockGetNote.mockResolvedValue(null);
      // Date A's upsert never resolves — simulates an autosave still retrying
      // after the component unmounted.
      mockUpsertNote.mockReturnValue(new Promise(() => {}));

      const dateA = renderHook(() => useNotes("2026-07-12"), { wrapper });
      await waitFor(() =>
        expect(dateA.result.current[1].isLoading).toBe(false),
      );
      act(() => dateA.result.current[1].upsertNote({ content: "hi" }));
      await waitFor(() =>
        expect(mockUpsertNote.mock.calls.length).toBeGreaterThan(0),
      );

      const dateB = renderHook(() => useNotes("2026-07-13"), { wrapper });
      await waitFor(() =>
        expect(dateB.result.current[1].isLoading).toBe(false),
      );
      const fetchCountForB = mockGetNote.mock.calls.filter(
        (call) => call[1] === "2026-07-13",
      ).length;

      const binding = captured!.bindings.find((b) => b.table === "notes")!;
      act(() => binding.handler({ table: "notes" }));
      act(() => jest.advanceTimersByTime(250));

      // Date A's still-pending autosave must not block date B's refetch.
      await waitFor(() =>
        expect(
          mockGetNote.mock.calls.filter((call) => call[1] === "2026-07-13")
            .length,
        ).toBeGreaterThan(fetchCountForB),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("invalidates every mapped key once on a rejoin after a drop, but not on the first subscribe", () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    renderHook(() => useRealtimeInvalidation("user-1"), { wrapper });

    act(() => captured!.statusHandler!("SUBSCRIBED"));
    expect(invalidateSpy).not.toHaveBeenCalled();

    act(() => captured!.statusHandler!("CHANNEL_ERROR"));
    act(() => captured!.statusHandler!("SUBSCRIBED"));

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      ([arg]) => (arg as { queryKey: string[] }).queryKey,
    );
    Object.values(REALTIME_INVALIDATIONS)
      .flat()
      .forEach((queryKey) => {
        expect(invalidatedKeys).toContainEqual(queryKey);
      });
  });

  it("removes the channel on unmount", () => {
    const { wrapper } = createWrapper();

    const { unmount } = renderHook(() => useRealtimeInvalidation("user-1"), {
      wrapper,
    });
    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });

  it("removes the old channel and opens a new one when the user changes", () => {
    const { wrapper } = createWrapper();

    const { rerender } = renderHook(
      ({ userId }: { userId: string | undefined }) =>
        useRealtimeInvalidation(userId),
      { wrapper, initialProps: { userId: "user-1" } },
    );
    rerender({ userId: "user-2" });

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockChannel).toHaveBeenCalledWith("invalidations:user-2");
  });
});
