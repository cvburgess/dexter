import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { ReactNode } from "react";

import { settleQueries } from "@/testUtils/settleQueries";

import { WEEK_CALENDAR_KEY, useWeekCalendar } from "../useWeekCalendar";

const renderWeekCalendar = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useWeekCalendar(), { wrapper }) };
};

describe("useWeekCalendar", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("restores a toggle on a fresh launch", async () => {
    const first = renderWeekCalendar();
    await act(() => first.result.current[1].toggle());
    await settleQueries(first.client);
    expect(first.result.current[0]).toBe(true);

    // A new client stands in for a relaunch: only AsyncStorage carries over.
    const second = renderWeekCalendar();
    await settleQueries(second.client);
    expect(second.result.current[0]).toBe(true);
  });

  it("lands off after two quick toggles", async () => {
    const { client, result } = renderWeekCalendar();

    // Both fire before a re-render; closing over `data` would leave it on.
    const { toggle } = result.current[1];
    await act(() => Promise.all([toggle(), toggle()]));
    await settleQueries(client);

    expect(result.current[0]).toBe(false);
    expect(await AsyncStorage.getItem(WEEK_CALENDAR_KEY)).toBe("false");
  });
});
