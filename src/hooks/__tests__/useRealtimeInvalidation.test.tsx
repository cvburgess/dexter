import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import { useDays } from "@/hooks/useDays";

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
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/api/days", () => ({ getDay: jest.fn(), upsertDay: jest.fn() }));

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

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("skips refetching a date's days query while its own autosave is in flight, then catches up once it settles", async () => {
    jest.useFakeTimers();
    try {
      const { wrapper } = createWrapper();
      renderHook(() => useRealtimeInvalidation("user-1"), { wrapper });

      let resolveUpsert: () => void = () => {};
      const daysApi =
        jest.requireMock<typeof import("@/api/days")>("@/api/days");
      (daysApi.getDay as jest.Mock).mockResolvedValue(null);
      (daysApi.upsertDay as jest.Mock).mockReturnValue(
        new Promise<void>((resolve) => {
          resolveUpsert = () =>
            resolve({ date: "2026-07-12", notes: "hi", prompts: [] } as never);
        }),
      );
      const usePreferencesMock = jest.requireMock<
        typeof import("@/hooks/usePreferences")
      >("@/hooks/usePreferences").usePreferences as jest.Mock;
      usePreferencesMock.mockReturnValue([
        { templateNote: "", templatePrompts: [] },
        { updatePreferences: jest.fn() },
      ]);

      const days = renderHook(() => useDays("2026-07-12"), { wrapper });
      await waitFor(() => expect(days.result.current[1].isLoading).toBe(false));
      // The initial mount already fetched this date once.
      const fetchCountBeforeEvent = (daysApi.getDay as jest.Mock).mock.calls
        .length;
      act(() => days.result.current[1].upsertDay({ notes: "hi" }));
      await waitFor(() =>
        expect((daysApi.upsertDay as jest.Mock).mock.calls.length).toBe(1),
      );

      const binding = captured!.bindings.find((b) => b.table === "days")!;
      act(() => binding.handler({ table: "days" }));
      act(() => jest.advanceTimersByTime(250));

      // Still mid-autosave for this exact date — no extra refetch yet.
      expect((daysApi.getDay as jest.Mock).mock.calls.length).toBe(
        fetchCountBeforeEvent,
      );

      act(() => resolveUpsert());
      await waitFor(() => expect(days.result.current[0].notes).toBe("hi"));

      act(() => binding.handler({ table: "days" }));
      act(() => jest.advanceTimersByTime(250));

      // The autosave has settled — the same date now refetches normally.
      await waitFor(() =>
        expect((daysApi.getDay as jest.Mock).mock.calls.length).toBeGreaterThan(
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

      const daysApi =
        jest.requireMock<typeof import("@/api/days")>("@/api/days");
      (daysApi.getDay as jest.Mock).mockResolvedValue(null);
      // Date A's upsert never resolves within this test — simulates an
      // autosave still retrying in the background after the component
      // unmounted (see useDays.tsx's retry comment).
      (daysApi.upsertDay as jest.Mock).mockReturnValue(new Promise(() => {}));
      const usePreferencesMock = jest.requireMock<
        typeof import("@/hooks/usePreferences")
      >("@/hooks/usePreferences").usePreferences as jest.Mock;
      usePreferencesMock.mockReturnValue([
        { templateNote: "", templatePrompts: [] },
        { updatePreferences: jest.fn() },
      ]);

      const dateA = renderHook(() => useDays("2026-07-12"), { wrapper });
      await waitFor(() =>
        expect(dateA.result.current[1].isLoading).toBe(false),
      );
      act(() => dateA.result.current[1].upsertDay({ notes: "hi" }));
      await waitFor(() =>
        expect(
          (daysApi.upsertDay as jest.Mock).mock.calls.length,
        ).toBeGreaterThan(0),
      );

      const dateB = renderHook(() => useDays("2026-07-13"), { wrapper });
      await waitFor(() =>
        expect(dateB.result.current[1].isLoading).toBe(false),
      );
      const fetchCountForB = (daysApi.getDay as jest.Mock).mock.calls.filter(
        (call) => call[1] === "2026-07-13",
      ).length;

      const binding = captured!.bindings.find((b) => b.table === "days")!;
      act(() => binding.handler({ table: "days" }));
      act(() => jest.advanceTimersByTime(250));

      // Date A's still-pending autosave must not block date B's refetch.
      await waitFor(() =>
        expect(
          (daysApi.getDay as jest.Mock).mock.calls.filter(
            (call) => call[1] === "2026-07-13",
          ).length,
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
