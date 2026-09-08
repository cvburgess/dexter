import { Temporal } from "@js-temporal/polyfill";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";

import {
  RitualRevealProvider,
  useStepReveal,
} from "@/components/RitualRevealProvider";
import { SEEN_RITUAL_STEPS_KEY } from "@/hooks/useSeenRitualSteps";

const TODAY = Temporal.PlainDate.from("2026-09-08");

jest.mock("@/hooks/useToday", () => {
  const { Temporal: mockTemporal } = jest.requireActual<
    typeof import("@js-temporal/polyfill")
  >("@js-temporal/polyfill");
  return { useToday: () => mockTemporal.PlainDate.from("2026-09-08") };
});

const renderReveal = (date = TODAY) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { result } = renderHook(() => useStepReveal(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <RitualRevealProvider date={date} mode="am" stepId="calendar">
          {children}
        </RitualRevealProvider>
      </QueryClientProvider>
    ),
  });
  return result;
};

describe("RitualRevealProvider", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("reports the step unseen once the device read settles", async () => {
    const result = renderReveal();

    await waitFor(() => expect(result.current.seen).toBe(false));
  });

  it("reports a step recorded for today as seen", async () => {
    await AsyncStorage.setItem(
      SEEN_RITUAL_STEPS_KEY,
      JSON.stringify({ date: "2026-09-08", keys: ["2026-09-08-am-calendar"] }),
    );

    const result = renderReveal();

    await waitFor(() => expect(result.current.seen).toBe(true));
  });

  // DEX-199: a live read would flip `seen` the moment a driver marks, and
  // `useHoroscopeAudio`'s `enabled` is a useFocusEffect dep — the track would
  // fade out seconds after it started.
  it("keeps reporting the step unseen for the rest of the visit after marking", async () => {
    const result = renderReveal();
    await waitFor(() => expect(result.current.seen).toBe(false));

    act(() => result.current.markRevealed());

    await waitFor(async () =>
      expect(await AsyncStorage.getItem(SEEN_RITUAL_STEPS_KEY)).not.toBeNull(),
    );
    expect(result.current.seen).toBe(false);
  });

  it("treats any day but today as already seen, without waiting or recording", async () => {
    const result = renderReveal(TODAY.subtract({ days: 1 }));

    // Never null: a past day must render in its final state on the first frame.
    expect(result.current.seen).toBe(true);

    act(() => result.current.markRevealed());

    await waitFor(() => expect(result.current.seen).toBe(true));
    expect(await AsyncStorage.getItem(SEEN_RITUAL_STEPS_KEY)).toBeNull();
  });

  it("leaves a step outside a provider ungated", () => {
    const { result } = renderHook(() => useStepReveal());

    expect(result.current.seen).toBe(false);
  });
});
