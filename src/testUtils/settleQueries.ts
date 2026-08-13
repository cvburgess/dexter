import type { QueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react-native";

/**
 * Waits for `client` to go quiet — nothing mutating, nothing fetching — and
 * then for the renders that work scheduled to actually land.
 *
 * The second half is the part that isn't obvious. The cache reaches its final
 * state one tick *before* its subscribers hear about it: react-query flushes
 * notifications from `notifyManager` on a `setTimeout(fn, 0)`. A test that
 * stops at the quiet cache still returns with that render queued, and React
 * reports it as a state update outside `act(...)` — blaming whichever test
 * runs next, which is why the 45 warnings this replaced never pointed at the
 * test that actually caused them (DEX-130).
 *
 * Reach for this to close any test that mutates. `onSettled` →
 * `invalidateQueries` → refetch → notify is a chain that no single `waitFor`
 * on a mock's call count can see the end of: the call count goes up when the
 * refetch *starts*.
 *
 * Needs real timers — under `jest.useFakeTimers()` the yield below never fires
 * and this hangs until the test times out. Drive those files with
 * `act(() => jest.runOnlyPendingTimers())` instead.
 */
export const settleQueries = async (client: QueryClient) => {
  await waitFor(() => {
    expect(client.isMutating()).toBe(0);
    expect(client.isFetching()).toBe(0);
  });

  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
};
