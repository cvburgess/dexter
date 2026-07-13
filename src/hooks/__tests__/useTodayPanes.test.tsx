import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import { TODAY_PANES_KEY, useTodayPanes } from "../useTodayPanes";

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe("useTodayPanes", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("defaults every pane to open when nothing is stored", async () => {
    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual({
      notes: true,
      journal: true,
      calendar: true,
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
      journal: true,
      calendar: true,
    });
  });

  it("defaults to open when the stored value is missing a key", async () => {
    await AsyncStorage.setItem(
      TODAY_PANES_KEY,
      JSON.stringify({ notes: false }),
    );

    const { result } = renderHook(() => useTodayPanes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isLoading).toBe(false));
    expect(result.current[0]).toEqual({
      notes: true,
      journal: true,
      calendar: true,
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
        journal: true,
        calendar: true,
      }),
    );
    const stored = await AsyncStorage.getItem(TODAY_PANES_KEY);
    expect(JSON.parse(stored as string)).toEqual({
      notes: false,
      journal: true,
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

    // Simulates two rapid button taps (e.g. Notes then Journal) landing
    // before the first toggle's AsyncStorage write resolves and re-renders
    // this hook — both must still be applied, not just the last one.
    await act(async () => {
      const first = result.current[1].togglePane("notes");
      const second = result.current[1].togglePane("journal");
      await Promise.all([first, second]);
    });

    const expected = { notes: false, journal: false, calendar: true };
    await waitFor(() => expect(result.current[0]).toEqual(expected));
    const stored = await AsyncStorage.getItem(TODAY_PANES_KEY);
    expect(JSON.parse(stored as string)).toEqual(expected);
  });
});
