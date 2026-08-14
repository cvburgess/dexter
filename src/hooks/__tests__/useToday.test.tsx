import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

import { useDayRollover, useToday } from "../useToday";

// Local, not UTC: the hook reads the device's calendar day, so a fixed instant
// has to be pinned in the zone the code will read it in — the same rule
// `__tests__/ritual/ritualScreen.test.tsx` states.
const localTime = (day: number, hour: number, minute = 0) =>
  new Date(2026, 7, day, hour, minute);

const foreground = (state: "active" | "background") => {
  const handleChange = (
    AppState.addEventListener as jest.MockedFunction<
      typeof AppState.addEventListener
    >
  ).mock.calls.at(-1)?.[1];
  act(() => handleChange?.(state));
};

describe("useToday (DEX-161)", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: localTime(14, 9) });
    jest.spyOn(AppState, "addEventListener");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const renderToday = () =>
    renderHook(() => {
      useDayRollover();
      return useToday();
    });

  it("serves the current day", () => {
    expect(renderToday().result.current.toString()).toBe("2026-08-14");
  });

  // The bug this hook exists for: the app was open before midnight, the device
  // slept, and the timer fired however late. Foregrounding has to correct it.
  it("moves to the new day when the app returns to the foreground", () => {
    const { result } = renderToday();

    act(() => {
      jest.setSystemTime(localTime(15, 8));
    });
    foreground("active");

    expect(result.current.toString()).toBe("2026-08-15");
  });

  // The other half: nobody backgrounded anything, the app just sat there.
  it("moves to the new day on its own while the app stays open", () => {
    const { result } = renderToday();

    act(() => {
      jest.advanceTimersByTime(16 * 60 * 60 * 1000);
    });

    expect(result.current.toString()).toBe("2026-08-15");
  });

  it("keeps re-arming, day after day", () => {
    const { result } = renderToday();

    act(() => {
      jest.advanceTimersByTime(16 * 60 * 60 * 1000);
    });
    act(() => {
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    });

    expect(result.current.toString()).toBe("2026-08-16");
  });

  // The identity contract: `usePublishViewedDay` keys a focus effect on this
  // value, so a fresh `PlainDate` per render would tear that effect down on
  // every unrelated re-render and momentarily clear the viewed day the nav
  // rail's "+" reads.
  it("hands back the same object until the day actually changes", () => {
    const { result, rerender } = renderToday();
    const first = result.current;

    rerender(undefined);
    act(() => {
      jest.advanceTimersByTime(60 * 60 * 1000);
    });
    foreground("background");
    foreground("active");

    expect(result.current).toBe(first);
  });

  it("stops watching once unmounted", () => {
    const { result, unmount } = renderToday();
    unmount();

    act(() => {
      jest.setSystemTime(localTime(15, 8));
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    });

    // Nothing subscribed to re-render, so the last value stands — the point is
    // that the timer didn't survive to fire against an unmounted tree.
    expect(result.current.toString()).toBe("2026-08-14");
    expect(jest.getTimerCount()).toBe(0);
  });
});
