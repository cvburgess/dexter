import type { QueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react-native";

// One more tick after quiet — react-query flushes notifications via
// setTimeout(0), so stopping earlier blames the next test (DEX-130).
export const settleQueries = async (client: QueryClient) => {
  await waitFor(() => {
    expect(client.isMutating()).toBe(0);
    expect(client.isFetching()).toBe(0);
  });

  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
};
