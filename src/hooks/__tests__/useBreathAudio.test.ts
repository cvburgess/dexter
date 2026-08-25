import { renderHook } from "@testing-library/react-native";
import { AudioManager } from "react-native-audio-api";

import { useBreathAudio } from "@/hooks/useBreathAudio";
import {
  BREATH_AUDIO_MAX_EVENTS_PER_PARAM,
  buildBreathePlan,
  MAX_BREATHS,
  type TBreathePlan,
} from "@/utils/breathing";

// An audio graph this file can read back. Everything the hook does is scheduled
// against `currentTime` on gain and frequency params, so those calls are the
// only observable behaviour — the global stub in `jest.setup.js` is inert on
// purpose, and this replaces it.
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
  // Defined inside the factory rather than closed over: the hook calls this at
  // *module* scope, so it fires while this file's own `const`s are still being
  // initialized and anything declared above would not exist yet.
  AudioManager: { disableSessionManagement: jest.fn() },
}));

// Read before any `clearAllMocks` can wipe it. Importing the hook is the whole
// event — there is nothing later to observe. The reference is only read for its
// call count, never invoked detached, so `unbound-method` has nothing to protect
// here (the same case `utils/__tests__/alert.web.test.ts` documents).
const disabledSessionsOnImport = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  AudioManager.disableSessionManagement,
).mock.calls.length;

// Stand in for react-navigation's focus lifecycle, as `useHoroscopeAudio.test.ts`
// does: the effect runs on mount (focus) and its cleanup on unmount (blur). The
// hook memoizes on `[plan, running]`, so "unmount" stands for switching tabs and
// for swiping to the next step alike.
//
// Bumping the generation and re-rendering additionally re-runs the effect with
// its arguments *untouched* — a real blur-then-focus, which no prop change can
// model, because the component stays mounted and the hook's refs survive it.
// Held on an object rather than a `let` because the hoisted `jest.mock` factory
// closes over this, and Babel makes a captured binding read-only; the property
// is writable even though the variable is not.
const mockFocus = { generation: 0 };

jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      // The rule is right that mutating this does not itself re-render — the
      // test bumps it and re-renders, and the dependency is what turns that
      // render into a fresh focus.
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

// Gains in the order the hook builds them: the master everything lands on, the
// reverb's wet and dry sides, then one per voice. Counted from the end rather
// than named individually, so adding or dropping a voice does not touch this.
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
  // Drain whichever fade's `setTimeout` is pending before handing the clock
  // back, so a test that unmounts does not leave the close running into the
  // next one.
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

  // Deliberately thin on the sound itself: the chords, registers and envelopes
  // are still being tuned by ear, so anything pinning them would be rewritten
  // every pass. What is left is the lifecycle, which is not in flux.
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

  // DEX-187: the library caps a param's queues and drops the overflow in
  // silence, so a voice that overran simply stopped changing and droned under
  // the rest of the run. Two curves a leg rather than a staircase of ramps is
  // what keeps it clear. The longest run the slider offers is the worst case.
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

  // A filter feeding more than one gain would have each of them scaling its
  // output buffer in turn — a gain multiplies its input in place, and the graph
  // hands every consumer the same buffer. That is audible as scratchy,
  // half-silent phases, so the voice count is what the graph is pinned to.
  it("keeps one gain per voice however long the run is", () => {
    renderHook(() =>
      useBreathAudio(buildBreathePlan("box", MAX_BREATHS), true, quitRef()),
    );

    // The master, the reverb's wet and dry sides, and one gain per voice.
    expect(mockGains.length).toBe(3 + 4);
  });

  // `setValueCurveAtTime` is not forgiving: the library refuses a curve whose
  // window is not clear, and refusing means an exception out of Begin rather
  // than a slightly wrong sound. This replays its own rule
  // (`ParamControlQueue::checkCurveExclusion`) over the exact times the hook
  // schedules — the only way to see this without a device.
  //
  // The clock is deliberately an ugly number: the curve times are reached by
  // different arithmetic on the way in, so a schedule sitting on exact
  // adjacency would be one float rounding away from throwing.
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

  // The fade shape falls from 1 to 0 and has to be scaled by wherever the
  // master sits, or its first ramp opens *above* the level the run was playing
  // at — a step up in volume at the moment someone taps away.
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

  // A run that reached its end is the exercise finishing on its own terms, so
  // it gets long enough for the last tone and the reverb to settle. One that was
  // cut off is a response to someone who already left.
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

  // The name of the test above is the invariant, and it used to hold only by
  // arithmetic accident: the settle was the reverb's length outright, so
  // shortening the reverb past the exit fade would have had finishing the
  // exercise cut off faster than walking away from it.
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

  // Only the audio is focus-scoped; the fill animates on regardless. Opening on
  // the first inhale against a fill most of the way through a run would be worse
  // than hearing nothing.
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

  // A settle runs for seconds after the run ends, and nothing about `running`
  // turning false leaves anything behind that could cut it — so leaving the step
  // used to carry it onto the next one.
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
