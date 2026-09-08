import { renderHook } from "@testing-library/react-native";
import { AudioManager } from "react-native-audio-api";

import { SUNRISE_MS } from "@/components/SunriseBackground";
import { useSunriseAudio } from "@/hooks/useSunriseAudio";

// The global stub in jest.setup.js is inert on purpose; this replaces it with
// an audio graph that records the gain/frequency calls the hook schedules.
const mockParam = () => ({
  cancelAndHoldAtTime: jest.fn(),
  linearRampToValueAtTime: jest.fn(),
  setValueAtTime: jest.fn(),
  setValueCurveAtTime: jest.fn(),
});

type TMockOscillator = {
  connect: jest.Mock;
  detune: ReturnType<typeof mockParam>;
  frequency: ReturnType<typeof mockParam>;
  start: jest.Mock;
  stop: jest.Mock;
  type: string;
};

const mockOscillators: TMockOscillator[] = [];
const mockGains: { connect: jest.Mock; gain: ReturnType<typeof mockParam> }[] =
  [];
const mockClose = jest.fn().mockResolvedValue(undefined);

const mockContext = {
  close: mockClose,
  createBiquadFilter: jest.fn(() => ({
    connect: jest.fn(),
    frequency: mockParam(),
    type: "lowpass",
  })),
  createGain: jest.fn(() => {
    const gain = { connect: jest.fn(), gain: mockParam() };
    mockGains.push(gain);
    return gain;
  }),
  createOscillator: jest.fn(() => {
    const oscillator: TMockOscillator = {
      connect: jest.fn(),
      detune: mockParam(),
      frequency: mockParam(),
      start: jest.fn(),
      stop: jest.fn(),
      type: "sine",
    };
    mockOscillators.push(oscillator);
    return oscillator;
  }),
  currentTime: 0,
  destination: {},
};
const mockAudioContext = jest.fn(() => mockContext);

jest.mock("react-native-audio-api", () => ({
  AudioContext: function () {
    return mockAudioContext();
  },
  // Defined inside the factory: the hook calls this at module scope, before
  // this file's own consts finish initializing.
  AudioManager: { disableSessionManagement: jest.fn() },
}));

// Read before clearAllMocks wipes it — importing the hook is the whole event.
const disabledSessionsOnImport = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  AudioManager.disableSessionManagement,
).mock.calls.length;

// Bumping generation re-runs the effect with args untouched — a real
// blur-then-focus. An object: Babel makes a captured `let` read-only.
const mockFocus = { generation: 0 };

jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      // Mutating this doesn't itself re-render; the test bumps it and
      // re-renders, and the dependency is what turns that into a fresh focus.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      useEffect(() => effect(), [effect, mockFocus.generation]);
    },
  };
});

const SETTLE_MS = 1800;
const EXIT_FADE_MS = 1200;
const MAX_VOLUME = 0.1;
// Mirrors the hook's own lead-in: the stack is scheduled a beat ahead of the
// context clock so `setValueCurveAtTime` never clamps a start time forward.
const LEAD_IN_SECONDS = 0.05;

const DAY = "2026-08-09";

// The hook builds the master first, then one gain per partial.
const masterGain = () => mockGains[0].gain;
const partialGains = () => mockGains.slice(1);

/** Every curve scheduled on a param, as a start/end window in seconds. */
const curvesOn = (param: ReturnType<typeof mockParam>) =>
  (
    param.setValueCurveAtTime.mock.calls as [Float32Array, number, number][]
  ).map(([values, at, duration]) => ({ values, at, end: at + duration }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockOscillators.length = 0;
  mockGains.length = 0;
  mockContext.currentTime = 0;
  mockFocus.generation = 0;
});

afterEach(() => {
  // Drain whichever fade's setTimeout is pending, or an unmounted test's
  // close runs into the next one.
  jest.advanceTimersByTime(EXIT_FADE_MS * 2);
  jest.useRealTimers();
});

describe("useSunriseAudio", () => {
  it("hands the audio session back to the system", () => {
    // At module scope, so importing the hook is enough — a phone on silent has
    // to stay silent, matching the horoscope track and the breathing tones.
    expect(disabledSessionsOnImport).toBe(1);
  });

  // One null covers all three of the caller's gates: still loading, a blank
  // day with no bands to accompany, and reduced motion.
  it("makes no sound without a day to sound", () => {
    renderHook(() => useSunriseAudio(null));

    expect(mockAudioContext).not.toHaveBeenCalled();
  });

  // Thin on the sound itself — partials and envelopes are still tuned by ear.
  // What's left is the lifecycle, which isn't in flux.
  it("opens a partial per band and leaves them all silent to start", () => {
    renderHook(() => useSunriseAudio(DAY));

    // Two detuned oscillators per partial, into one gain each.
    expect(mockOscillators).toHaveLength(partialGains().length * 2);
    expect(mockContext.createBiquadFilter).toHaveBeenCalledTimes(1);

    // Either anchored silent at the start, or opening from a curve whose own
    // first sample is zero — never left sitting at a gain node's default of 1.
    for (const { gain } of partialGains()) {
      const [curve] = curvesOn(gain);
      const anchored = gain.setValueAtTime.mock.calls.some(
        ([value, at]) => value === 0 && at === LEAD_IN_SECONDS,
      );
      expect(anchored || curve.at === LEAD_IN_SECONDS).toBe(true);
      expect(curve.values[0]).toBe(0);
    }
    expect(mockOscillators.every((o) => o.start.mock.calls.length === 1)).toBe(
      true,
    );
  });

  // The whole envelope goes onto the audio clock at once — there is no timer,
  // so nothing can drift away from the bands it is supposed to track.
  it("schedules against the context clock, wherever it already is", () => {
    mockContext.currentTime = 40;
    renderHook(() => useSunriseAudio(DAY));

    const starts = partialGains().flatMap((gain) =>
      curvesOn(gain.gain).map((curve) => curve.at),
    );
    expect(starts.length).toBeGreaterThan(0);
    expect(Math.min(...starts)).toBeGreaterThan(40);
  });

  // The point of the feature: a swell that finishes before or with the bands,
  // then a settle that ends by the time the figures have finished arriving.
  it("swells with the bands and settles with the figures", () => {
    renderHook(() => useSunriseAudio(DAY));

    const rangeEnds = LEAD_IN_SECONDS + SUNRISE_MS / 1000;
    for (const { gain } of partialGains()) {
      for (const curve of curvesOn(gain)) {
        expect(curve.at).toBeGreaterThanOrEqual(LEAD_IN_SECONDS);
        expect(curve.end).toBeLessThanOrEqual(rangeEnds + Number.EPSILON);
      }
    }

    const [decay] = curvesOn(masterGain());
    expect(decay.at).toBeCloseTo(rangeEnds);
    expect(decay.end).toBeCloseTo(rangeEnds + SETTLE_MS / 1000);
    // Ends in silence rather than being cut off there.
    expect(decay.values[decay.values.length - 1]).toBeCloseTo(0);
  });

  // Five partials summing coherently at the peak is the one moment this could
  // clip; each buys only its weighted share of the ceiling.
  it("never lets the stack sum past its ceiling", () => {
    renderHook(() => useSunriseAudio(DAY));

    const peaks = partialGains().flatMap((gain) =>
      curvesOn(gain.gain).map((curve) => Math.max(...curve.values)),
    );
    // Two oscillators per gain, so each partial's peak lands twice. The
    // tolerance is Float32 storage: the weights sum to exactly 1 in float64.
    const summed = peaks.reduce((sum, peak) => sum + peak, 0) * 2;
    expect(summed).toBeLessThanOrEqual(1 + 1e-6);
    expect(masterGain().setValueAtTime).toHaveBeenCalledWith(
      MAX_VOLUME,
      LEAD_IN_SECONDS,
    );
  });

  // Scaled by where the envelope has actually got to, or the fade opens by
  // jumping the settle louder than it was playing.
  it("never fades from louder than it was playing", () => {
    // Well into the settle: the envelope is past its peak by now.
    const { unmount } = renderHook(() => useSunriseAudio(DAY));
    mockContext.currentTime = LEAD_IN_SECONDS + (SUNRISE_MS + 900) / 1000;

    unmount();

    const [[held]] = masterGain().setValueAtTime.mock.calls.slice(-1) as [
      [number, number],
    ];
    expect(held).toBeLessThan(MAX_VOLUME);
    for (const [value] of masterGain().linearRampToValueAtTime.mock.calls as [
      number,
      number,
    ][]) {
      expect(value).toBeLessThanOrEqual(held);
    }
  });

  it("fades out through the master and releases the context on the way out", () => {
    const { unmount } = renderHook(() => useSunriseAudio(DAY));

    unmount();

    // One fade, on the node everything is connected through — fading the
    // partials instead would need five envelopes to land together.
    expect(masterGain().cancelAndHoldAtTime).toHaveBeenCalledWith(0);
    expect(masterGain().linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      EXIT_FADE_MS / 1000,
    );
    for (const oscillator of mockOscillators) {
      expect(oscillator.stop).toHaveBeenCalledWith(EXIT_FADE_MS / 1000);
    }

    // Closing tears the graph down wherever it has got to, so it has to
    // outlast the fade rather than cut it short.
    expect(mockClose).not.toHaveBeenCalled();
    jest.advanceTimersByTime(EXIT_FADE_MS);
    expect(mockClose).toHaveBeenCalled();
  });

  // Past the envelope's own end the oscillators have already stopped; asking
  // for a later stop is not the library's happy path.
  it("does not push a stop past where the sound already ended", () => {
    const { unmount } = renderHook(() => useSunriseAudio(DAY));
    const endsAt = LEAD_IN_SECONDS + (SUNRISE_MS + SETTLE_MS) / 1000;
    mockContext.currentTime = endsAt;

    unmount();

    for (const oscillator of mockOscillators) {
      expect(oscillator.stop).toHaveBeenCalledWith(endsAt);
    }
  });

  // Only the audio is focus-scoped; SunriseBackground animates on regardless,
  // so a step returned to has a settled sky and nothing left to accompany.
  it("stays silent rather than replaying a sunrise it comes back to", () => {
    const { rerender } = renderHook<void, object>(() => useSunriseAudio(DAY), {
      initialProps: {},
    });
    expect(mockAudioContext).toHaveBeenCalledTimes(1);

    // Away to another tab and back, mid-sunrise.
    mockFocus.generation += 1;
    rerender({});

    expect(mockAudioContext).toHaveBeenCalledTimes(1);
    // And the departure still silenced it, rather than leaving it playing on.
    expect(masterGain().cancelAndHoldAtTime).toHaveBeenCalled();
  });

  // Swiping away and straight back remounts the step: the second sunrise has
  // to cut the first one's fade rather than sound over it.
  it("cuts a fade still in flight when a fresh sunrise starts", () => {
    const first = renderHook(() => useSunriseAudio(DAY));
    first.unmount();
    expect(mockClose).not.toHaveBeenCalled();

    renderHook(() => useSunriseAudio(DAY));

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockAudioContext).toHaveBeenCalledTimes(2);
  });
});
