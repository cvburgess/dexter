import { renderHook } from "@testing-library/react-native";
import { AudioManager } from "react-native-audio-api";

import { useBreathAudio } from "@/hooks/useBreathAudio";
import {
  BREATH_AUDIO_MAX_EVENTS_PER_PARAM,
  buildBreathePlan,
  MAX_BREATHS,
  type TBreathePlan,
} from "@/utils/breathing";

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
  createBuffer: jest.fn((_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  })),
  createConvolver: jest.fn(() => ({
    buffer: null,
    connect: jest.fn(),
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
  // Keeps the generated impulse response tiny — the real one is
  // `sampleRate * seconds` samples of noise and nothing here listens to it.
  sampleRate: 64,
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

const END_FADE_MS = 3000;
const EXIT_FADE_MS = 1500;
// Mirrors the hook's own lead-in: a run is scheduled a beat ahead of the
// context clock so `setValueCurveAtTime` never clamps a start time forward.
const LEAD_IN_SECONDS = 0.05;

// Order the hook builds them: master, reverb wet/dry, then one per voice.
// Counted from the end so adding/dropping a voice doesn't touch this.
const masterGain = () => mockGains[0].gain;
const voiceGains = () => mockGains.slice(3);

/** How the step reports an ending: a run that was cut off, or one that finished. */
const quitRef = () => ({ current: false });
const completedRef = () => ({ current: true });

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
  jest.advanceTimersByTime(END_FADE_MS * 2);
  jest.useRealTimers();
});

describe("useBreathAudio", () => {
  it("hands the audio session back to the system", () => {
    // At module scope, so importing the hook is enough — a phone on silent has
    // to stay silent, matching the horoscope track.
    expect(disabledSessionsOnImport).toBe(1);
  });

  it("makes no sound without a plan", () => {
    renderHook(() => useBreathAudio(null, true, quitRef()));

    expect(mockAudioContext).not.toHaveBeenCalled();
  });

  it("makes no sound until the run starts", () => {
    renderHook(() =>
      useBreathAudio(buildBreathePlan("simple", 2), false, quitRef()),
    );

    expect(mockAudioContext).not.toHaveBeenCalled();
  });

  // Thin on the sound itself — chords/registers/envelopes are still tuned by
  // ear. What's left is the lifecycle, which isn't in flux.
  it("opens a voice per phase and leaves them all silent to start", () => {
    renderHook(() =>
      useBreathAudio(buildBreathePlan("box", 1), true, quitRef()),
    );

    expect(mockOscillators.length).toBeGreaterThan(0);
    // One filter per voice, one reverb for all of them.
    expect(mockContext.createBiquadFilter).toHaveBeenCalledTimes(
      voiceGains().length,
    );
    expect(mockContext.createConvolver).toHaveBeenCalledTimes(1);

    for (const gain of voiceGains()) {
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0, LEAD_IN_SECONDS);
    }
    expect(mockOscillators.every((o) => o.start.mock.calls.length === 1)).toBe(
      true,
    );
  });

  // The whole run goes onto the audio clock at Begin — there is no timer, so
  // nothing after this point can drift over a 200-second Box run.
  it("schedules against the context clock, wherever it already is", () => {
    mockContext.currentTime = 40;
    renderHook(() =>
      useBreathAudio(buildBreathePlan("simple", 1), true, quitRef()),
    );

    const times = voiceGains().flatMap((gain) =>
      (
        gain.gain.setValueCurveAtTime.mock.calls as [
          Float32Array,
          number,
          number,
        ][]
      ).map(([, at]) => at),
    );
    expect(times.length).toBeGreaterThan(0);
    expect(Math.min(...times)).toBeGreaterThan(40);
  });

  // DEX-187: the library silently drops overflow, leaving a voice droning
  // unchanged. Two curves a leg keeps it clear; longest run is worst case.
  it("keeps every gain inside the library's automation budget", () => {
    renderHook(() =>
      useBreathAudio(buildBreathePlan("box", MAX_BREATHS), true, quitRef()),
    );

    for (const { gain } of mockGains) {
      const events =
        gain.setValueAtTime.mock.calls.length +
        gain.linearRampToValueAtTime.mock.calls.length +
        gain.setValueCurveAtTime.mock.calls.length;
      expect(events).toBeLessThanOrEqual(BREATH_AUDIO_MAX_EVENTS_PER_PARAM);
    }
  });

  // A filter feeding several gains has each scale the last one's output in
  // turn (a gain multiplies in place) — audible as scratchy, half-silent phases.
  it("keeps one gain per voice however long the run is", () => {
    renderHook(() =>
      useBreathAudio(buildBreathePlan("box", MAX_BREATHS), true, quitRef()),
    );

    // The master, the reverb's wet and dry sides, and one gain per voice.
    expect(mockGains.length).toBe(3 + 4);
  });

  // Replays the library's own exclusion rule over the hook's exact scheduled
  // times — the only way to catch float rounding without a device.
  it.each(["simple", "relax", "box"] as const)(
    "schedules curves the library will not reject (%s)",
    (technique) => {
      mockContext.currentTime = 40.0517;
      renderHook(() =>
        useBreathAudio(
          buildBreathePlan(technique, MAX_BREATHS),
          true,
          quitRef(),
        ),
      );

      for (const { gain } of mockGains) {
        const curves = (
          gain.setValueCurveAtTime.mock.calls as [
            Float32Array,
            number,
            number,
          ][]
        ).map(([, at, duration]) => ({ at, end: at + duration }));
        const instants = (
          gain.setValueAtTime.mock.calls as [number, number][]
        ).map(([, at]) => at);
        const everyStart = [...instants, ...curves.map((c) => c.at)];

        curves.forEach((curve, index) => {
          // Rule one: nothing may start strictly inside this curve's window.
          for (const start of everyStart) {
            if (start > curve.at && start < curve.end) {
              throw new Error(
                `event at ${start} falls inside curve ${curve.at}..${curve.end}`,
              );
            }
          }
          // Rule two: a curve already under way at this one's start is a
          // conflict — landing exactly on its close is what is allowed.
          curves.forEach((other, otherIndex) => {
            if (otherIndex === index || other.at > curve.at) return;
            expect(curve.at).toBeGreaterThanOrEqual(other.end);
          });
        });
      }
    },
  );

  // Scaled by wherever the master sits, or the first ramp opens louder than
  // the run was playing — a volume jump the moment someone taps away.
  it("never fades from louder than the run was playing", () => {
    const { rerender } = renderHook<void, { running: boolean }>(
      ({ running }) =>
        useBreathAudio(buildBreathePlan("box", 2), running, quitRef()),
      { initialProps: { running: true } },
    );

    const [[level]] = masterGain().setValueAtTime.mock.calls as [
      number,
      number,
    ][];
    rerender({ running: false });

    for (const [value] of masterGain().linearRampToValueAtTime.mock.calls as [
      number,
      number,
    ][]) {
      expect(value).toBeLessThanOrEqual(level);
    }
  });

  it("fades out through the master and releases the context on the way out", () => {
    const { unmount } = renderHook(() =>
      useBreathAudio(buildBreathePlan("box", 1), true, quitRef()),
    );

    unmount();

    // One fade, and it sits *after* the reverb — fading the voices instead
    // would leave the tail ringing on into a closed context.
    expect(masterGain().cancelAndHoldAtTime).toHaveBeenCalledWith(0);
    expect(masterGain().linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      EXIT_FADE_MS / 1000,
    );
    for (const oscillator of mockOscillators) {
      expect(oscillator.stop).toHaveBeenCalledWith(EXIT_FADE_MS / 1000);
    }

    // Closing tears the graph down wherever it has got to, so it has to outlast
    // the fade rather than cut it short.
    expect(mockClose).not.toHaveBeenCalled();
    jest.advanceTimersByTime(EXIT_FADE_MS);
    expect(mockClose).toHaveBeenCalled();
  });

  // A finished run gets long enough for the last tone and reverb to settle;
  // a cut-off one is a response to someone who already left.
  it("takes longer to fade a run that finished than one that was cut off", () => {
    const plan = buildBreathePlan("simple", 1);
    const { unmount } = renderHook(() =>
      useBreathAudio(plan, true, completedRef()),
    );

    unmount();

    expect(masterGain().linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      END_FADE_MS / 1000,
    );
    jest.advanceTimersByTime(EXIT_FADE_MS);
    expect(mockClose).not.toHaveBeenCalled();
    jest.advanceTimersByTime(END_FADE_MS);
    expect(mockClose).toHaveBeenCalled();
  });

  // Used to hold only by accident — the settle was the reverb's length
  // outright, so shortening it past the exit fade would invert the ordering.
  it("gives a finished run a longer ending than a quit, whatever the reverb", () => {
    expect(END_FADE_MS).toBeGreaterThan(EXIT_FADE_MS);
  });

  it("silences a run that is tapped away rather than finished", () => {
    const plan = buildBreathePlan("simple", 3);
    const { rerender } = renderHook<void, { running: boolean }>(
      ({ running }) => useBreathAudio(plan, running, quitRef()),
      { initialProps: { running: true } },
    );

    rerender({ running: false });

    expect(masterGain().cancelAndHoldAtTime).toHaveBeenCalled();
    jest.advanceTimersByTime(EXIT_FADE_MS);
    expect(mockClose).toHaveBeenCalled();
  });

  // Only the audio is focus-scoped; opening on the first inhale against a
  // fill mid-run would be worse than hearing nothing.
  it("stays silent rather than restarting a run it comes back to", () => {
    const plan = buildBreathePlan("box", 4);
    const { rerender } = renderHook<void, object>(
      () => useBreathAudio(plan, true, quitRef()),
      { initialProps: {} },
    );
    expect(mockAudioContext).toHaveBeenCalledTimes(1);

    // Away to another tab and back, mid-run.
    mockFocus.generation += 1;
    rerender({});

    expect(mockAudioContext).toHaveBeenCalledTimes(1);
    // And the departure still silenced it, rather than leaving it playing on.
    expect(masterGain().cancelAndHoldAtTime).toHaveBeenCalled();
  });

  // A settle runs for seconds after `running` turns false, with nothing to
  // cut it — so leaving the step used to carry it onto the next one.
  it("cuts a settle still in flight when the step is left", () => {
    const plan = buildBreathePlan("simple", 1);
    const finished = completedRef();
    const { rerender, unmount } = renderHook<void, { running: boolean }>(
      ({ running }) => useBreathAudio(plan, running, finished),
      { initialProps: { running: true } },
    );

    // The run reaches its end: the settle starts, and the context is still open.
    rerender({ running: false });
    expect(mockClose).not.toHaveBeenCalled();

    // Swiping to the next step, well inside the settle.
    unmount();
    expect(mockClose).toHaveBeenCalled();
  });

  it("starts a fresh context when Begin is pressed again", () => {
    const { rerender } = renderHook<void, { plan: TBreathePlan }>(
      ({ plan }) => useBreathAudio(plan, true, quitRef()),
      { initialProps: { plan: buildBreathePlan("simple", 1) } },
    );

    // A fresh plan object per press is what re-triggers the run.
    rerender({ plan: buildBreathePlan("simple", 1) });

    expect(mockAudioContext).toHaveBeenCalledTimes(2);
  });
});
