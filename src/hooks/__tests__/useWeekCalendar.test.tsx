import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import { WEEK_CALENDAR_KEY, useWeekCalendar } from "../useWeekCalendar";

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
};

describe("useWeekCalendar", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("restores a toggle on a fresh launch", async () => {
    const first = renderHook(() => useWeekCalendar(), {
      wrapper: createWrapper(),
    });
    await act(async () => {}); // let the initial storage read land first
    await act(() => first.result.current[1].toggle());
    expect(first.result.current[0]).toBe(true);

    // A new client stands in for a relaunch: only AsyncStorage carries over.
    const second = renderHook(() => useWeekCalendar(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(second.result.current[0]).toBe(true));
  });

  it("lands off after two quick toggles", async () => {
    const { result } = renderHook(() => useWeekCalendar(), {
      wrapper: createWrapper(),
    });

    await act(async () => {});
    // Both fire before a re-render; closing over `data` would leave it on.
    const { toggle } = result.current[1];
    await act(() => Promise.all([toggle(), toggle()]));

    expect(result.current[0]).toBe(false);
    expect(await AsyncStorage.getItem(WEEK_CALENDAR_KEY)).toBe("false");
  });
});
