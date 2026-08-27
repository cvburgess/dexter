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

  it("defaults every pane to open, except the task drawer, when nothing is stored", async () => {
    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual({
      notes: true,
      calendar: true,
      drawer: false,
    });
  });

  it("defaults to open when the stored value is corrupt JSON", async () => {
    await AsyncStorage.setItem(TODAY_PANES_KEY, "{not json");

    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual({
      notes: true,
      calendar: true,
      drawer: false,
    });
  });

  it("defaults to open when the stored value has an invalid key type", async () => {
    await AsyncStorage.setItem(
      TODAY_PANES_KEY,
      JSON.stringify({ notes: "yes" }),
    );

    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual({
      notes: true,
      calendar: true,
      drawer: false,
    });
  });

  it("fills in a pane added after the value was stored, keeping the rest", async () => {
    // Pre-`drawer`, still-`journal` (DEX-105) stored value — the missing key
    // falls back to default and the removed one drops, not a full reset.
    await AsyncStorage.setItem(
      TODAY_PANES_KEY,
      JSON.stringify({ notes: false, journal: true, calendar: false }),
    );

    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual({
      notes: false,
      calendar: false,
      drawer: false,
    });
  });

  it("toggles a single pane and persists the change", async () => {
    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    await act(() => result.current[1].togglePane("notes"));

    await waitFor(() =>
      expect(result.current[0]).toEqual({
        notes: false,
        calendar: true,
        drawer: false,
      }),
    );
    const stored = await AsyncStorage.getItem(TODAY_PANES_KEY);
    expect(JSON.parse(stored as string)).toEqual({
      notes: false,
      calendar: true,
      drawer: false,
    });
  });

  it("toggles the task drawer pane independently of the others", async () => {
    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    await act(() => result.current[1].togglePane("drawer"));

    await waitFor(() => expect(result.current[0].drawer).toBe(true));
    expect(result.current[0]).toMatchObject({
      notes: true,
      calendar: true,
    });
  });

  it("toggling a pane twice returns it to open", async () => {
    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    await act(() => result.current[1].togglePane("calendar"));
    await waitFor(() => expect(result.current[0].calendar).toBe(false));
    await act(() => result.current[1].togglePane("calendar"));

    await waitFor(() => expect(result.current[0].calendar).toBe(true));
  });

  it("applies two toggles fired before either resolves, without losing one", async () => {
    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current[1].isLoading).toBe(false));

    // Two rapid taps land before the first toggle's write resolves — both
    // must apply, not just the last one.
    await act(async () => {
      const first = result.current[1].togglePane("notes");
      const second = result.current[1].togglePane("calendar");
      await Promise.all([first, second]);
    });

    const expected = {
      notes: false,
      calendar: false,
      drawer: false,
    };
    await waitFor(() => expect(result.current[0]).toEqual(expected));
    const stored = await AsyncStorage.getItem(TODAY_PANES_KEY);
    expect(JSON.parse(stored as string)).toEqual(expected);
  });
});
