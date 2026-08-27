import { act, renderHook } from "@testing-library/react-native";
import { AudioManager, decodeAudioData } from "react-native-audio-api";

import { useHoroscopeAudio } from "@/hooks/useHoroscopeAudio";

// The global stub in jest.setup.js is inert on purpose; this replaces it
// with an audio graph that records the gain-param calls the hook schedules.
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

// The decode fires at module scope, before this file's own consts exist, so
// the deferred is handed back via the mocked module's `__mockDecode` instead.
jest.mock("react-native-audio-api", () => {
  const mockDecode = {
    resolve: (_buffer: { duration: number }) => {},
  };

  return {
    // Defined inside the factory: it must exist before this file's own
    // declarations run, since the hook creates its context at focus time.
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

// Mount/unmount stand in for focus/blur; toggling `enabled` re-runs the
// effect exactly as a real blur-then-focus would.
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

// Read before clearAllMocks wipes them — importing the hook is the whole event.
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
  // Drain whichever fade's setTimeout is pending, or an unmounted test's
  // close runs into the next one.
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
    // Anchored twice: at the start, then again where the tail begins — a
    // ramp alone would slope over the whole track instead of the last seconds.
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
    // The hold cancels the still-scheduled tail ramp; the fade rides from
    // wherever the gain actually is.
    expect(gain.cancelAndHoldAtTime).toHaveBeenCalledWith(0);
    // Unanchored, the ramp would slope from the t=0 set and be mostly gone
    // the instant cleanup runs.
    expect(gain.setValueAtTime).toHaveBeenCalledTimes(3);
    expect(gain.setValueAtTime).toHaveBeenLastCalledWith(MAX_VOLUME, 0);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      EXIT_FADE_MS / 1000,
    );
    expect(mockSources[0].stop).toHaveBeenCalledWith(EXIT_FADE_MS / 1000);

    // Closing tears the context down, so it has to outlast the fade.
    expect(mockContexts[0].close).not.toHaveBeenCalled();
    jest.advanceTimersByTime(EXIT_FADE_MS);
    expect(mockContexts[0].close).toHaveBeenCalled();
  });

  // Pins that cleanup is driven by the hook's input, not only teardown; the
  // mock stands focus in as mount, so it can't catch a plain-useEffect regression.
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

  // Returning inside the exit fade used to leave the outgoing player running
  // while a new one started — the same track over itself at two positions.
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

  // Cleanup flags the pending continuation since the effect can't await the
  // decode — otherwise a blur during load leaves a source with no cleanup.
  it("does not start playback when the step blurs before the decode settles", async () => {
    const { unmount } = renderHook(() => useHoroscopeAudio(true));
    unmount();

    await settleDecode();

    expect(mockAudioContext).not.toHaveBeenCalled();
    expect(mockSources).toHaveLength(0);
  });
});
