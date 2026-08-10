import { renderHook } from "@testing-library/react-native";

import { useHoroscopeAudio } from "@/hooks/useHoroscopeAudio";

// A player this file can drive: the fades are arithmetic over `currentTime`
// and the clock, and both are only observable through what they write to
// `volume`. The global stub in `jest.setup.js` is inert on purpose, so this
// replaces it.
const mockPlayer = {
  currentTime: 0,
  duration: 0,
  loop: true,
  pause: jest.fn(),
  play: jest.fn(),
  remove: jest.fn(),
  volume: 0,
};
const mockCreateAudioPlayer = jest.fn(() => mockPlayer);
jest.mock("expo-audio", () => ({
  createAudioPlayer: () => mockCreateAudioPlayer(),
}));

// Stand in for react-navigation's focus lifecycle, as `useViewedDay.test.tsx`
// does: run the effect on mount (focus) and its cleanup on unmount (blur). The
// hook memoizes on `[enabled]`, so toggling that re-runs it exactly as a real
// blur-then-focus would — which is what makes "unmount" below stand for
// switching tabs as well as leaving the step.
jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(() => effect(), [effect]);
    },
  };
});

const TAIL_FADE_MS = 5000;
const EXIT_FADE_MS = 2000;
// Mirrors the hook's own ceiling: it is ambience, so every level below is a
// fraction of this rather than of 1.
const MAX_VOLUME = 0.1;

beforeEach(() => {
  jest.useFakeTimers();
  // `Date.now` follows the fake clock, which is what the exit fade reads.
  jest.setSystemTime(0);
  jest.clearAllMocks();
  Object.assign(mockPlayer, {
    currentTime: 0,
    duration: 0,
    loop: true,
    volume: 0,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useHoroscopeAudio", () => {
  it("does nothing at all until enabled", () => {
    renderHook(() => useHoroscopeAudio(false));

    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
  });

  it("starts at its ceiling, and does not loop", () => {
    renderHook(() => useHoroscopeAudio(true));

    expect(mockPlayer.play).toHaveBeenCalled();
    expect(mockPlayer.volume).toBe(MAX_VOLUME);
    expect(mockPlayer.loop).toBe(false);
  });

  // `duration` is 0 until the track loads. Dividing by the remaining time
  // before then would compute a negative and silence the opening.
  it("leaves the volume alone while the track is still loading", () => {
    renderHook(() => useHoroscopeAudio(true));

    jest.advanceTimersByTime(1000);

    expect(mockPlayer.volume).toBe(MAX_VOLUME);
  });

  it("holds its ceiling until the tail", () => {
    renderHook(() => useHoroscopeAudio(true));
    Object.assign(mockPlayer, { duration: 30, currentTime: 10 });

    jest.advanceTimersByTime(100);

    expect(mockPlayer.volume).toBe(MAX_VOLUME);
  });

  it("rides the last seconds down to silence", () => {
    renderHook(() => useHoroscopeAudio(true));
    const halfway = 30 - TAIL_FADE_MS / 2000;

    Object.assign(mockPlayer, { duration: 30, currentTime: halfway });
    jest.advanceTimersByTime(100);
    expect(mockPlayer.volume).toBeCloseTo(MAX_VOLUME / 2, 2);

    Object.assign(mockPlayer, { currentTime: 30 });
    jest.advanceTimersByTime(100);
    expect(mockPlayer.volume).toBe(0);
  });

  // Switching tabs was the bug this hook shipped with: a tab navigator keeps
  // its screens mounted, so an unmount-scoped effect never cleaned up and the
  // track played on over the next tab. Worth being straight about what this
  // does and does not prove — the mock above stands focus in as mount, so it
  // cannot catch a regression back to plain `useEffect`. What it does pin is
  // that the cleanup path is driven by the hook's *input* rather than only by
  // teardown, which is the half that is testable here.
  it("fades when it stops being enabled, not only when it goes away", () => {
    const { rerender } = renderHook<void, { enabled: boolean }>(
      ({ enabled }) => useHoroscopeAudio(enabled),
      { initialProps: { enabled: true } },
    );

    rerender({ enabled: false });
    jest.advanceTimersByTime(EXIT_FADE_MS / 2);
    expect(mockPlayer.volume).toBeCloseTo(MAX_VOLUME / 2, 1);

    jest.advanceTimersByTime(EXIT_FADE_MS);
    expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
  });

  describe("on unmount", () => {
    it("fades out rather than cutting, then releases the player", () => {
      const { unmount } = renderHook(() => useHoroscopeAudio(true));
      Object.assign(mockPlayer, { duration: 30, currentTime: 0 });

      unmount();

      // Still audible immediately after leaving — the whole point of owning
      // the player rather than letting `useAudioPlayer` release it.
      expect(mockPlayer.remove).not.toHaveBeenCalled();

      jest.advanceTimersByTime(EXIT_FADE_MS / 2);
      expect(mockPlayer.volume).toBeCloseTo(MAX_VOLUME / 2, 1);
      expect(mockPlayer.remove).not.toHaveBeenCalled();

      jest.advanceTimersByTime(EXIT_FADE_MS / 2);
      expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
    });

    // Writing `volume` on a released player is a use-after-free. The interval
    // has one tick queued when the fade completes, so it has to be cleared
    // before the release rather than after.
    it("stops touching the player once it is released", () => {
      const { unmount } = renderHook(() => useHoroscopeAudio(true));

      unmount();
      jest.advanceTimersByTime(EXIT_FADE_MS * 3);

      const releasedAt = mockPlayer.volume;
      jest.advanceTimersByTime(EXIT_FADE_MS);

      expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
      expect(mockPlayer.volume).toBe(releasedAt);
    });

    // The tail fade must not keep writing over the exit fade — two intervals
    // fighting would make the ending stutter rather than fall away.
    it("stops the tail fade before starting the exit fade", () => {
      const { unmount } = renderHook(() => useHoroscopeAudio(true));
      Object.assign(mockPlayer, { duration: 30, currentTime: 0 });

      unmount();
      jest.advanceTimersByTime(EXIT_FADE_MS / 2);

      // The tail fade would have pushed this back to the ceiling (29s left).
      expect(mockPlayer.volume).toBeLessThan(MAX_VOLUME);
    });
  });
});
