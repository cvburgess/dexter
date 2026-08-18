import { act, renderHook } from "@testing-library/react-native";
import { AudioManager, decodeAudioData } from "react-native-audio-api";

import { useHoroscopeAudio } from "@/hooks/useHoroscopeAudio";

// An audio graph this file can read back. Everything the hook schedules lands
// on `currentTime` on gain params, so those calls are the only observable
// behaviour — the global stub in `jest.setup.js` is inert on purpose, and this
// replaces it.
const mockParam = () => ({
  cancelAndHoldAtTime: jest.fn(),
  linearRampToValueAtTime: jest.fn(),
  setValueAtTime: jest.fn(),
});

const mockSources: {
  buffer: { duration: number } | null;
  connect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
}[] = [];
const mockGains: { connect: jest.Mock; gain: ReturnType<typeof mockParam> }[] =
  [];
const mockContexts: {
  close: jest.Mock;
  createBufferSource: jest.Mock;
  createGain: jest.Mock;
  currentTime: number;
  destination: object;
  sampleRate: number;
}[] = [];

const mockAudioContext = jest.fn(() => {
  const context = {
    close: jest.fn().mockResolvedValue(undefined),
    createBufferSource: jest.fn(() => {
      const source = {
        buffer: null as { duration: number } | null,
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
      };
      mockSources.push(source);
      return source;
    }),
    createGain: jest.fn(() => {
      const gain = { connect: jest.fn(), gain: mockParam() };
      mockGains.push(gain);
      return gain;
    }),
    currentTime: 0,
    destination: {},
    sampleRate: 44100,
  };
  mockContexts.push(context);
  return context;
});

// The decode fires at *module* scope — while this file's own `const`s are
// still being initialized, so anything the promise closes over must live here.
// The deferred is handed back through the mocked module itself (`__mockDecode`
// below); tests resolve it to settle the track, and playback proceeds only
// after that.
jest.mock("react-native-audio-api", () => {
  const mockDecode = {
    resolve: (_buffer: { duration: number }) => {},
  };

  return {
    // Defined inside the factory rather than closed over: the hook creates
    // its playback context at *focus* time, but importing the hook still
    // needs the mock to exist, and the factory runs before this file's own
    // declarations do.
    AudioContext: function () {
      return mockAudioContext();
    },
    AudioManager: { disableSessionManagement: jest.fn() },
    decodeAudioData: jest.fn(
      () => new Promise((resolve) => (mockDecode.resolve = resolve)),
    ),
    __mockDecode: mockDecode,
  };
});

// The mocked module's test-only export: the deferred that settles the
// module-scope decode.
const mockDecode = jest.requireMock<{
  __mockDecode: { resolve: (buffer: { duration: number }) => void };
}>("react-native-audio-api").__mockDecode;

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

const TRACK_SECONDS = 30;
// Only what the hook reads off the buffer: its duration.
const TRACK_BUFFER = { duration: TRACK_SECONDS };
const TAIL_FADE_MS = 5000;
const EXIT_FADE_MS = 2000;
// Mirrors the hook's own ceiling: it is ambience, so every level below is a
// fraction of this rather than of 1.
const MAX_VOLUME = 0.1;

// Read before any `clearAllMocks` can wipe them. Importing the hook is the
// whole event — there is nothing later to observe.
const decodeCallsOnImport = jest.mocked(decodeAudioData).mock.calls.length;
const disabledSessionsOnImport = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  AudioManager.disableSessionManagement,
).mock.calls.length;

/** Settles the module-scope decode and flushes the playback continuation. */
const settleDecode = async () => {
  mockDecode.resolve(TRACK_BUFFER);
  await act(async () => {});
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSources.length = 0;
  mockGains.length = 0;
  mockContexts.length = 0;
});

afterEach(() => {
  // Drain whichever fade's `setTimeout` is pending before handing the clock
  // back, so a test that unmounts does not leave the close running into the
  // next one.
  jest.advanceTimersByTime(EXIT_FADE_MS * 2);
  jest.useRealTimers();
});

describe("useHoroscopeAudio", () => {
  it("hands the audio session back to the system", () => {
    // At module scope, so importing the hook is enough — a phone on silent has
    // to stay silent, matching the Breathe step.
    expect(disabledSessionsOnImport).toBe(1);
  });

  it("decodes the track once, at module scope", () => {
    expect(decodeCallsOnImport).toBe(1);
  });

  it("does nothing at all until enabled", () => {
    renderHook(() => useHoroscopeAudio(false));

    expect(mockAudioContext).not.toHaveBeenCalled();
    expect(mockSources).toHaveLength(0);
  });

  // The decode is a module-scope promise; only its settling starts playback.
  it("builds nothing until the decode settles", async () => {
    renderHook(() => useHoroscopeAudio(true));

    await act(async () => {});

    expect(mockAudioContext).not.toHaveBeenCalled();
    expect(mockSources).toHaveLength(0);
  });

  // The whole run goes onto the audio clock at focus: a held ceiling, a tail
  // ramp landing on the end of the buffer, and nothing ticking in between.
  it("starts at its ceiling with the fades scheduled up front", async () => {
    const interval = jest.spyOn(global, "setInterval");
    renderHook(() => useHoroscopeAudio(true));
    await settleDecode();

    expect(mockSources).toHaveLength(1);
    expect(mockSources[0].buffer).toBe(TRACK_BUFFER);
    expect(mockSources[0].start).toHaveBeenCalledWith(0);
    expect(mockSources[0].connect).toHaveBeenCalledWith(mockGains[0]);
    expect(mockGains[0].connect).toHaveBeenCalledWith(
      mockContexts[0].destination,
    );

    const gain = mockGains[0].gain;
    // Two sets: one anchors the ceiling at the start, the second anchors it
    // again where the tail begins — a ramp alone would slope over the whole
    // track instead of the last seconds.
    expect(gain.setValueAtTime).toHaveBeenCalledWith(MAX_VOLUME, 0);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(
      MAX_VOLUME,
      TRACK_SECONDS - TAIL_FADE_MS / 1000,
    );
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, TRACK_SECONDS);
    // Nothing ticks while the track plays — the old player polled `currentTime`
    // on a 20fps interval to drive its fades.
    expect(interval).not.toHaveBeenCalled();
  });

  it("fades out on the audio clock rather than cutting, then closes the context", async () => {
    const { unmount } = renderHook(() => useHoroscopeAudio(true));
    await settleDecode();

    unmount();

    const gain = mockGains[0].gain;
    // The tail ramp is still scheduled; the hold cancels it and the fade rides
    // from wherever the gain actually is.
    expect(gain.cancelAndHoldAtTime).toHaveBeenCalledWith(0);
    // The anchor: with the tail events gone, the ramp must start at `now` at
    // the tail's value there — unanchored it would slope from the t=0 set and
    // be mostly gone the instant the cleanup runs.
    expect(gain.setValueAtTime).toHaveBeenCalledTimes(3);
    expect(gain.setValueAtTime).toHaveBeenLastCalledWith(MAX_VOLUME, 0);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      EXIT_FADE_MS / 1000,
    );
    expect(mockSources[0].stop).toHaveBeenCalledWith(EXIT_FADE_MS / 1000);

    // Closing tears the context down wherever it is, so it has to outlast the
    // fade rather than cut it short.
    expect(mockContexts[0].close).not.toHaveBeenCalled();
    jest.advanceTimersByTime(EXIT_FADE_MS);
    expect(mockContexts[0].close).toHaveBeenCalled();
  });

  // Switching tabs was the bug this hook shipped with: a tab navigator keeps
  // its screens mounted, so an unmount-scoped effect never cleaned up and the
  // track played on over the next tab. Worth being straight about what this
  // does and does not prove — the mock above stands focus in as mount, so it
  // cannot catch a regression back to plain `useEffect`. What it does pin is
  // that the cleanup path is driven by the hook's *input* rather than only by
  // teardown, which is the half that is testable here.
  it("fades when it stops being enabled, not only when it goes away", async () => {
    const { rerender } = renderHook<void, { enabled: boolean }>(
      ({ enabled }) => useHoroscopeAudio(enabled),
      { initialProps: { enabled: true } },
    );
    await settleDecode();

    rerender({ enabled: false });

    expect(mockGains[0].gain.cancelAndHoldAtTime).toHaveBeenCalled();
    jest.advanceTimersByTime(EXIT_FADE_MS);
    expect(mockContexts[0].close).toHaveBeenCalled();
  });

  // Coming back inside the two-second exit fade — swipe to the next step and
  // straight back, or tab away and return — used to leave the outgoing player
  // running while a new one started, laying the same track over itself at two
  // positions. An echo, not ambience.
  it("never leaves two tracks audible at once", async () => {
    const first = renderHook(() => useHoroscopeAudio(true));
    await settleDecode();
    first.unmount();

    // Half a second into the fade, so the first context is still open.
    jest.advanceTimersByTime(500);
    expect(mockContexts[0].close).not.toHaveBeenCalled();

    renderHook(() => useHoroscopeAudio(true));
    await settleDecode();

    // Re-entry cuts the fading context at once rather than layering the same
    // track over itself at two positions.
    expect(mockContexts[0].close).toHaveBeenCalledTimes(1);
    expect(mockSources).toHaveLength(2);

    // And the abandoned fade's timer must not close it again once the new
    // track has taken over the slot.
    jest.advanceTimersByTime(EXIT_FADE_MS * 2);
    expect(mockContexts[0].close).toHaveBeenCalledTimes(1);
  });

  // The first entry pays for the decode, and that is when a swipe away is
  // most likely. `useFocusEffect`'s callback cannot await it, so the cleanup
  // flags the pending continuation — without that, a blur during the first
  // load would leave a source running with no cleanup registered.
  it("does not start playback when the step blurs before the decode settles", async () => {
    const { unmount } = renderHook(() => useHoroscopeAudio(true));
    unmount();

    await settleDecode();

    expect(mockAudioContext).not.toHaveBeenCalled();
    expect(mockSources).toHaveLength(0);
  });
});
