import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import { TODAY_PANES_KEY, useTodayPanes } from "../useTodayPanes";

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

describe("useTodayPanes", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("defaults the task drawer closed when nothing is stored", async () => {
    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual({ drawer: false });
  });

  it("defaults when the stored value is corrupt JSON", async () => {
    await AsyncStorage.setItem(TODAY_PANES_KEY, "{not json");

    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual({ drawer: false });
  });

  it("defaults when the stored value has an invalid key type", async () => {
    await AsyncStorage.setItem(
      TODAY_PANES_KEY,
      JSON.stringify({ drawer: "yes" }),
    );

    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual({ drawer: false });
  });

  it("drops the keys of panes that no longer exist, keeping the rest", async () => {
    // Simulates a device that stored its panes while `journal` (DEX-105) and
    // the Notes/Calendar toggles (DEX-152) still existed. The removed keys are
    // dropped and the surviving one keeps the user's choice, rather than the
    // whole value being treated as corrupt and reset — which is what lets a
    // pane be retired without a migration.
    await AsyncStorage.setItem(
      TODAY_PANES_KEY,
      JSON.stringify({
        notes: false,
        journal: true,
        calendar: false,
        drawer: true,
      }),
    );

    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual({ drawer: true });
  });

  it("fills in a pane added after the value was stored", async () => {
    await AsyncStorage.setItem(TODAY_PANES_KEY, JSON.stringify({}));

    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual({ drawer: false });
  });

  it("toggles a pane and persists the change", async () => {
    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    await act(() => result.current[1].togglePane("drawer"));

    await waitFor(() => expect(result.current[0]).toEqual({ drawer: true }));
    const stored = await AsyncStorage.getItem(TODAY_PANES_KEY);
    expect(JSON.parse(stored as string)).toEqual({ drawer: true });
  });

  it("toggling a pane twice returns it to closed", async () => {
    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    await act(() => result.current[1].togglePane("drawer"));
    await waitFor(() => expect(result.current[0].drawer).toBe(true));
    await act(() => result.current[1].togglePane("drawer"));

    await waitFor(() => expect(result.current[0].drawer).toBe(false));
  });

  it("applies two toggles fired before either resolves, without losing one", async () => {
    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    // Simulates two rapid taps landing before the first toggle's AsyncStorage
    // write resolves and re-renders this hook. Both must be applied to the
    // *cache*, leaving the pane back where it started — reading the value
    // closed over at the last render instead would have both see `false` and
    // both write `true`, leaving the drawer open after an even number of taps.
    await act(async () => {
      const first = result.current[1].togglePane("drawer");
      const second = result.current[1].togglePane("drawer");
      await Promise.all([first, second]);
    });

    await waitFor(() => expect(result.current[0]).toEqual({ drawer: false }));
    // Read back rather than trusting the hook's own state: the key exists only
    // because both writes ran, so a value of `false` here is the second toggle
    // having seen the first rather than neither having happened at all.
    const stored = await AsyncStorage.getItem(TODAY_PANES_KEY);
    expect(JSON.parse(stored as string)).toEqual({ drawer: false });
  });

  it("opens a pane without closing one already open", async () => {
    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    await act(() => result.current[1].openPane("drawer"));
    await waitFor(() => expect(result.current[0].drawer).toBe(true));
    await act(() => result.current[1].openPane("drawer"));

    await waitFor(() => expect(result.current[0].drawer).toBe(true));
  });
});
