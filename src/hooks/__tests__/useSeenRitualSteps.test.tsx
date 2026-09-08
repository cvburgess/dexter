import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import {
  SEEN_RITUAL_STEPS_KEY,
  useSeenRitualSteps,
} from "../useSeenRitualSteps";

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

const NOTHING_SEEN = { date: "", keys: [] };

const renderSeen = async () => {
  const { result } = renderHook(() => useSeenRitualSteps(), {
    wrapper: createWrapper(),
  });
  await waitFor(() => expect(result.current[1].isLoading).toBe(false));
  return result;
};

describe("useSeenRitualSteps", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  // The failure mode that would otherwise silently suppress every reveal.
  it.each([
    ["nothing is stored", undefined],
    ["the stored value is corrupt JSON", "{not json"],
    ["the stored value is the wrong shape", JSON.stringify({ keys: "all" })],
  ])("reads as nothing seen when %s", async (_case, stored) => {
    if (stored) await AsyncStorage.setItem(SEEN_RITUAL_STEPS_KEY, stored);

    const result = await renderSeen();

    expect(result.current[0]).toEqual(NOTHING_SEEN);
  });

  it("marks a step seen and persists it", async () => {
    const result = await renderSeen();

    await act(() =>
      result.current[1].markSeen("2026-09-08", "2026-09-08-am-calendar"),
    );

    const expected = { date: "2026-09-08", keys: ["2026-09-08-am-calendar"] };
    await waitFor(() => expect(result.current[0]).toEqual(expected));
    const stored = await AsyncStorage.getItem(SEEN_RITUAL_STEPS_KEY);
    expect(JSON.parse(stored as string)).toEqual(expected);
  });

  it("replaces rather than appends when the day changes", async () => {
    await AsyncStorage.setItem(
      SEEN_RITUAL_STEPS_KEY,
      JSON.stringify({ date: "2026-09-07", keys: ["2026-09-07-am-calendar"] }),
    );
    const result = await renderSeen();

    // Yesterday's record reads as nothing seen today, so every step animates
    // again — and writing today's first step drops yesterday's entirely.
    expect(result.current[0].keys).toEqual(["2026-09-07-am-calendar"]);

    await act(() =>
      result.current[1].markSeen("2026-09-08", "2026-09-08-am-backlog"),
    );

    const expected = { date: "2026-09-08", keys: ["2026-09-08-am-backlog"] };
    await waitFor(() => expect(result.current[0]).toEqual(expected));
    const stored = await AsyncStorage.getItem(SEEN_RITUAL_STEPS_KEY);
    expect(JSON.parse(stored as string)).toEqual(expected);
  });

  it("applies two marks fired before either resolves, without losing one", async () => {
    const result = await renderSeen();

    // Summary drives its sunrise and its hero in the same tick — both must land.
    await act(async () => {
      await Promise.all([
        result.current[1].markSeen("2026-09-08", "2026-09-08-am-summary"),
        result.current[1].markSeen("2026-09-08", "2026-09-08-am-review"),
      ]);
    });

    const expected = {
      date: "2026-09-08",
      keys: ["2026-09-08-am-summary", "2026-09-08-am-review"],
    };
    await waitFor(() => expect(result.current[0]).toEqual(expected));
    const stored = await AsyncStorage.getItem(SEEN_RITUAL_STEPS_KEY);
    expect(JSON.parse(stored as string)).toEqual(expected);
  });
});
