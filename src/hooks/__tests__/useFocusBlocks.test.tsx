import { Temporal } from "@js-temporal/polyfill";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import {
  createFocusBlock,
  getLiveFocusBlock,
  TFocusBlock,
  updateFocusBlock,
} from "@/api/focusBlocks";
import { useLiveFocusBlock } from "@/hooks/useFocusBlocks";

// useAuth reads the app's URI scheme at module scope, unavailable under
// Jest. `userId` gates the query, so it has to be a real value.
jest.mock("@/hooks/useAuth", () => ({
  supabase: {},
  useAuth: () => ({ userId: "user-1" }),
}));
jest.mock("@/api/focusBlocks", () => ({
  createFocusBlock: jest.fn(),
  getFocusBlocks: jest.fn(),
  getLiveFocusBlock: jest.fn(),
  updateFocusBlock: jest.fn(),
}));

const mockCreate = createFocusBlock as jest.MockedFunction<
  typeof createFocusBlock
>;
const mockGetLive = getLiveFocusBlock as jest.MockedFunction<
  typeof getLiveFocusBlock
>;
const mockUpdate = updateFocusBlock as jest.MockedFunction<
  typeof updateFocusBlock
>;

const START = Date.parse("2026-08-13T10:00:00.000Z");

const block = (overrides: Partial<TFocusBlock> = {}): TFocusBlock =>
  ({
    id: "block-1",
    date: "2026-08-13",
    remainingSeconds: 1500,
    resumedAt: new Date(START).toISOString(),
    status: "active",
    taskId: "task-1",
    totalSeconds: 1500,
    tasks: { id: "task-1", title: "Write report" },
    ...overrides,
  }) as TFocusBlock;

/** A client whose preferences cache is already warm, since `startFocusBlock`
 * awaits the saved row rather than reading the placeholder. */
const createWrapper = (focusBlockMinutes = 25) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(["preferences"], { focusBlockMinutes });

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

const renderLive = (focusBlockMinutes?: number) => {
  const { wrapper } = createWrapper(focusBlockMinutes);
  return renderHook(() => useLiveFocusBlock(), { wrapper });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(START);
  mockGetLive.mockResolvedValue(null);
  mockCreate.mockResolvedValue(block());
  mockUpdate.mockImplementation((_supabase, diff) =>
    Promise.resolve(block({ ...diff })),
  );
});

afterEach(() => {
  jest.useRealTimers();
});

describe("startFocusBlock", () => {
  // The placeholder would start a 25-minute block for someone who chose 50
  // and hasn't loaded their row yet — this awaits ensureQueryData instead.
  it("runs for the saved length, not the default", async () => {
    const { result } = renderLive(50);

    act(() => result.current[1].startFocusBlock("task-9"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][1]).toMatchObject({
      remainingSeconds: 3000,
      taskId: "task-9",
      totalSeconds: 3000,
    });
  });

  // The local calendar day, not a UTC instant: a block started late in the
  // evening west of UTC would otherwise be counted by the next day's ritual.
  it("stamps the local day and an anchor to count down from", async () => {
    const { result } = renderLive();

    act(() => result.current[1].startFocusBlock("task-1"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const created = mockCreate.mock.calls[0][1];
    expect(created.date).toBe(Temporal.Now.plainDateISO().toString());
    // Stamped from the client's own clock, so both ends of every later
    // subtraction come from the same one.
    expect(Date.parse(created.resumedAt)).toBeGreaterThanOrEqual(START);
    expect(Date.parse(created.resumedAt)).toBeLessThan(START + 1000);
  });
});

describe("the transitions", () => {
  beforeEach(() => {
    mockGetLive.mockResolvedValue(block());
  });

  // Dropping either half is silent: no snapshot restarts the timer from full
  // on resume; no cleared anchor violates resumed_at_iff_active.
  it("pauses onto a snapshot and clears the anchor", async () => {
    const { result } = renderLive();
    await waitFor(() => expect(result.current[0]).not.toBeNull());

    jest.setSystemTime(START + 60_000);
    act(() => result.current[1].pauseFocusBlock(result.current[0]!));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toEqual({
      id: "block-1",
      remainingSeconds: 1440,
      resumedAt: null,
      status: "paused",
    });
  });

  // Resuming moves the anchor and *only* the anchor — rewriting
  // `remainingSeconds` here would discard the pause's snapshot.
  it("resumes onto a fresh anchor without touching the snapshot", async () => {
    mockGetLive.mockResolvedValue(
      block({ status: "paused", remainingSeconds: 900, resumedAt: null }),
    );
    const { result } = renderLive();
    await waitFor(() => expect(result.current[0]).not.toBeNull());

    jest.setSystemTime(START + 120_000);
    act(() => result.current[1].resumeFocusBlock(result.current[0]!));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toEqual({
      id: "block-1",
      resumedAt: new Date(START + 120_000).toISOString(),
      status: "active",
    });
  });

  // The invariant the evening's figure rests on: stopping early is recorded,
  // but never as a completion.
  it("cancels rather than completing when stopped early", async () => {
    const { result } = renderLive();
    await waitFor(() => expect(result.current[0]).not.toBeNull());

    act(() => result.current[1].cancelFocusBlock(result.current[0]!));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ status: "cancelled" });
  });

  it("finishes onto zero", async () => {
    const { result } = renderLive();
    await waitFor(() => expect(result.current[0]).not.toBeNull());

    act(() => result.current[1].finishFocusBlock(result.current[0]!));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toEqual({
      id: "block-1",
      remainingSeconds: 0,
      resumedAt: null,
      status: "complete",
    });
  });

  // The timeout and the AppState listener can both come due for the same
  // block; the second must not rewrite a row that has already ended.
  it("ignores a transition on a block that already ended", async () => {
    const { result } = renderLive();
    await waitFor(() => expect(result.current[0]).not.toBeNull());

    act(() =>
      result.current[1].finishFocusBlock(block({ status: "complete" })),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // Held open deliberately so the assertion lands mid-write, and settled
  // before the test ends — a pending mutation would wedge the whole run.
  it("clears the live block before the write comes back", async () => {
    let settle: (block: TFocusBlock) => void = () => {};
    mockUpdate.mockReturnValueOnce(
      new Promise<TFocusBlock>((resolve) => {
        settle = resolve;
      }),
    );

    const { result } = renderLive();
    await waitFor(() => expect(result.current[0]).not.toBeNull());

    act(() => result.current[1].cancelFocusBlock(result.current[0]!));

    // `onMutate` awaits `cancelQueries` before writing, so the clear lands a
    // microtask after the tap rather than synchronously with it.
    await waitFor(() => expect(result.current[0]).toBeNull());

    await act(() => {
      settle(block({ status: "cancelled", resumedAt: null }));
      return Promise.resolve();
    });
  });
});
