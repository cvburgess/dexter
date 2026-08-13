import { act, renderHook } from "@testing-library/react-native";

import { TFocusBlock } from "@/api/focusBlocks";
import { useLiveFocusBlock } from "@/hooks/useFocusBlocks";
import { useFocusTimer, usePublishFocusTimer } from "@/hooks/useFocusTimer";

jest.mock("@/hooks/useAuth", () => ({
  supabase: {},
  useAuth: () => ({ userId: "user-1" }),
}));
jest.mock("@/hooks/useFocusBlocks", () => ({
  useLiveFocusBlock: jest.fn(),
}));

const mockUseLiveFocusBlock = useLiveFocusBlock as jest.MockedFunction<
  typeof useLiveFocusBlock
>;

const START = Date.parse("2026-08-13T10:00:00.000Z");

const block = (overrides: Partial<TFocusBlock> = {}): TFocusBlock =>
  ({
    id: "block-1",
    date: "2026-08-13",
    remainingSeconds: 60,
    resumedAt: new Date(START).toISOString(),
    status: "active",
    taskId: "task-1",
    totalSeconds: 1500,
    tasks: { id: "task-1", title: "Write report" },
    ...overrides,
  }) as TFocusBlock;

const finishFocusBlock = jest.fn();

/** Seeds what `useLiveFocusBlock` hands the publisher. */
const setLiveBlock = (live: TFocusBlock | null) => {
  mockUseLiveFocusBlock.mockReturnValue([
    live,
    {
      cancelFocusBlock: jest.fn(),
      finishFocusBlock,
      isLoading: false,
      pauseFocusBlock: jest.fn(),
      resumeFocusBlock: jest.fn(),
      startFocusBlock: jest.fn(),
    },
  ]);
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(START);
  setLiveBlock(null);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("the published snapshot", () => {
  it("is empty until a publisher mounts", () => {
    const { result } = renderHook(() => useFocusTimer());

    expect(result.current.block).toBeNull();
  });

  it("carries the live block while one is published", () => {
    const live = block();
    setLiveBlock(live);

    renderHook(() => usePublishFocusTimer());
    const { result } = renderHook(() => useFocusTimer());

    expect(result.current.block).toBe(live);
  });

  // Otherwise a signed-out accessory keeps drawing a timer belonging to the
  // account that just left.
  it("clears when the publisher unmounts", () => {
    setLiveBlock(block());
    const publisher = renderHook(() => usePublishFocusTimer());
    const { result } = renderHook(() => useFocusTimer());

    publisher.unmount();

    expect(result.current.block).toBeNull();
  });

  // `useSyncExternalStore` compares snapshots by identity, so republishing a
  // fresh object every render would re-render every subscriber every render —
  // and the accessory is one of them, twice over.
  it("does not re-render a subscriber when the block is unchanged", () => {
    const live = block();
    setLiveBlock(live);

    const publisher = renderHook(() => usePublishFocusTimer());
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useFocusTimer();
    });

    const before = renders;
    publisher.rerender(undefined);
    publisher.rerender(undefined);

    expect(renders).toBe(before);
  });
});

describe("completing a block when its time runs out", () => {
  it("writes complete once the countdown reaches zero", () => {
    setLiveBlock(block({ remainingSeconds: 60 }));
    renderHook(() => usePublishFocusTimer());

    expect(finishFocusBlock).not.toHaveBeenCalled();

    act(() => {
      jest.setSystemTime(START + 60_000);
      jest.advanceTimersByTime(60_000);
    });

    expect(finishFocusBlock).toHaveBeenCalledTimes(1);
  });

  // The timeout and the AppState listener can both come due for the same block,
  // and the row's own status is no guard — both closures captured it while it
  // was still active.
  it("writes complete exactly once, not once per due signal", () => {
    setLiveBlock(block({ remainingSeconds: 60 }));
    renderHook(() => usePublishFocusTimer());

    act(() => {
      jest.setSystemTime(START + 60_000);
      jest.advanceTimersByTime(60_000);
    });
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(finishFocusBlock).toHaveBeenCalledTimes(1);
  });

  // The app was closed or force-quit straight through the end of the block.
  // Because `date` was stamped when it started, it still counts toward the
  // right day however late this runs.
  it("completes a block that was already past due at mount", () => {
    jest.setSystemTime(START + 3_600_000);
    setLiveBlock(block({ remainingSeconds: 60 }));

    renderHook(() => usePublishFocusTimer());

    expect(finishFocusBlock).toHaveBeenCalledTimes(1);
  });

  // A paused block's remaining time cannot move, so no amount of wall-clock
  // time may end it.
  it("never completes a paused block, however long it sits", () => {
    setLiveBlock(
      block({ status: "paused", remainingSeconds: 60, resumedAt: null }),
    );
    renderHook(() => usePublishFocusTimer());

    act(() => {
      jest.setSystemTime(START + 86_400_000);
      jest.advanceTimersByTime(86_400_000);
    });

    expect(finishFocusBlock).not.toHaveBeenCalled();
  });

  it("does nothing at all with no block", () => {
    renderHook(() => usePublishFocusTimer());

    act(() => {
      jest.advanceTimersByTime(86_400_000);
    });

    expect(finishFocusBlock).not.toHaveBeenCalled();
  });
});
