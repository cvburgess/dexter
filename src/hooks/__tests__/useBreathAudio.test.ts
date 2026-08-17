import { renderHook } from "@testing-library/react-native";
import { AudioManager } from "react-native-audio-api";

import { useBreathAudio } from "@/hooks/useBreathAudio";
import { buildBreathePlan, type TBreathePlan } from "@/utils/breathing";

// An audio graph this file can read back. Everything the hook does is scheduled
// against `currentTime` on gain and frequency params, so those calls are the
// only observable behaviour — the global stub in `jest.setup.js` is inert on
// purpose, and this replaces it.
const mockParam = () => ({
  cancelAndHoldAtTime: jest.fn(),
  linearRampToValueAtTime: jest.fn(),
  setValueAtTime: jest.fn(),
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

// Mirror the hook's own constants rather than importing them — a test that
// reads the value it is checking cannot notice it changing.
const CHORD = {
  breath: [220, 329.63, 440],
  hold: [329.63, 493.88],
  exhale: [164.81, 220, 261.63],
};
const DETUNE_CENTS = 4;
const EXIT_FADE_MS = 600;
// Each voice divides its ceiling across its oscillators, so a chord cannot sum
// past the level one note was set to.
const BREATH_PEAK = 0.22 / (CHORD.breath.length * 2);
const HOLD_PEAK = 0.12 / (CHORD.hold.length * 2);
const EXHALE_PEAK = 0.14 / (CHORD.exhale.length * 2);

// Gains, in the order the hook builds them: the master everything lands on, the
// reverb's wet and dry sides, then one per voice.
const masterGain = () => mockGains[0].gain;
const breathGain = () => mockGains[3].gain;
const holdGain = () => mockGains[4].gain;
const exhaleGain = () => mockGains[5].gain;

/** The oscillators belonging to each voice, in creation order. */
const oscillatorsFor = (which: keyof typeof CHORD) => {
  const order = ["breath", "hold", "exhale"] as const;
  const before = order
    .slice(0, order.indexOf(which))
    .reduce((sum, name) => sum + CHORD[name].length * 2, 0);
  return mockOscillators.slice(before, before + CHORD[which].length * 2);
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockOscillators.length = 0;
  mockGains.length = 0;
  mockContext.currentTime = 0;
  mockFocus.generation = 0;
});

afterEach(() => {
  // Drain the exit fade's `setTimeout` before handing the clock back, so a test
  // that unmounts does not leave the close pending into the next one.
  jest.advanceTimersByTime(EXIT_FADE_MS * 2);
  jest.useRealTimers();
});

describe("useBreathAudio", () => {
  it("hands the audio session back to the system", () => {
    // At module scope, so importing the hook is enough — a phone on silent has
    // to stay silent, matching the horoscope track.
    expect(disabledSessionsOnImport).toBe(1);
  });

  it("makes no sound without a plan", () => {
    renderHook(() => useBreathAudio(null, true));

    expect(mockAudioContext).not.toHaveBeenCalled();
  });

  it("makes no sound until the run starts", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("simple", 2), false));

    expect(mockAudioContext).not.toHaveBeenCalled();
  });

  it("builds each voice as a chord of detuned pairs, silent to start", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("box", 1), true));

    // Two oscillators per note, either side of it — a lone oscillator has no
    // second one to beat against, which is what the warmth comes from.
    expect(oscillatorsFor("breath")).toHaveLength(6);
    expect(oscillatorsFor("hold")).toHaveLength(4);
    expect(oscillatorsFor("exhale")).toHaveLength(6);

    const pitches = oscillatorsFor("breath").map(
      (o) => o.frequency.setValueAtTime.mock.calls[0][0],
    );
    expect(pitches).toEqual([220, 220, 329.63, 329.63, 440, 440]);

    // The exhale resolves *downward* from the breath's root, which is most of
    // what makes it legible as "let go" rather than as another swell.
    const exhalePitches = oscillatorsFor("exhale").map(
      (o) => o.frequency.setValueAtTime.mock.calls[0][0],
    );
    expect(exhalePitches).toEqual([164.81, 164.81, 220, 220, 261.63, 261.63]);
    expect(Math.max(...exhalePitches)).toBeLessThan(Math.max(...pitches));

    const cents = oscillatorsFor("breath").map(
      (o) => o.detune.setValueAtTime.mock.calls[0][0],
    );
    expect(cents).toEqual([
      -DETUNE_CENTS,
      DETUNE_CENTS,
      -DETUNE_CENTS,
      DETUNE_CENTS,
      -DETUNE_CENTS,
      DETUNE_CENTS,
    ]);

    // A lowpass has nothing to take off a sine, so the pad has to carry
    // harmonics for the filter to shape anything at all.
    expect(oscillatorsFor("breath").every((o) => o.type === "triangle")).toBe(
      true,
    );
    expect(oscillatorsFor("exhale").every((o) => o.type === "triangle")).toBe(
      true,
    );
    expect(oscillatorsFor("hold").every((o) => o.type === "sine")).toBe(true);

    // Silent until the schedule opens them, so nothing sounds between starting
    // the oscillators and the first ramp.
    expect(breathGain().setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(holdGain().setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(exhaleGain().setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(mockOscillators.every((o) => o.start.mock.calls.length === 1)).toBe(
      true,
    );
  });

  // Space is most of what separates an instrument from a signal generator.
  it("routes the voices through a filter and a generated reverb", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("simple", 1), true));

    expect(mockContext.createBiquadFilter).toHaveBeenCalledTimes(1);
    expect(mockContext.createConvolver).toHaveBeenCalledTimes(1);
    // Two channels of independent noise, so the tail arrives wider than the
    // mono chord feeding it.
    expect(mockContext.createBuffer).toHaveBeenCalledWith(2, 256, 64);
  });

  // The whole run goes onto the audio clock at Begin — there is no timer, so
  // nothing after this point can drift over a 200-second Box run.
  it("schedules the entire run up front, in seconds from the context clock", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("simple", 1), true));

    // Simple is inhale 6s then exhale 6s, and each leg lands exactly on its
    // endpoint rather than near it.
    expect(breathGain().linearRampToValueAtTime).toHaveBeenCalledWith(
      BREATH_PEAK,
      6,
    );
    expect(breathGain().linearRampToValueAtTime).toHaveBeenCalledWith(0, 12);
    expect(breathGain().setValueAtTime).toHaveBeenCalledWith(BREATH_PEAK, 6);
  });

  // A straight line is what made the first attempt sound mechanical: the ear
  // hears the corner where a ramp starts far more than the slope after it.
  it("eases each leg rather than ramping it straight", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("simple", 1), true));

    const ramps: [number, number][] =
      breathGain().linearRampToValueAtTime.mock.calls;
    const valueAt = (time: number) =>
      ramps.find(([, at]) => at === time)?.[0] as number;

    // Halfway through a six-second inhale an eased rise is at half its peak —
    // but a quarter of the way through it is still well below a quarter, which
    // a straight line could not be.
    expect(valueAt(3)).toBeCloseTo(BREATH_PEAK * 0.5, 6);
    expect(valueAt(1.5)).toBeLessThan(BREATH_PEAK * 0.25);
  });

  it("offsets the schedule from wherever the context clock already is", () => {
    mockContext.currentTime = 40;
    renderHook(() => useBreathAudio(buildBreathePlan("simple", 1), true));

    expect(breathGain().linearRampToValueAtTime).toHaveBeenCalledWith(
      BREATH_PEAK,
      46,
    );
    expect(breathGain().linearRampToValueAtTime).toHaveBeenCalledWith(0, 52);
  });

  // A rise and a fall of one chord are the same sound run backwards, which the
  // screen makes obvious and the ear very nearly misses — so the turn at the top
  // of the breath has to announce itself.
  it("marks the exhale with an accent that crests early and falls away", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("simple", 1), true));

    const ramps: [number, number][] =
      exhaleGain().linearRampToValueAtTime.mock.calls;
    const valueAt = (time: number) =>
      ramps.find(([, at]) => at === time)?.[0] as number;

    // Simple exhales from 6s to 12s. The accent crests a sixth of the way in —
    // a sigh, against the hold's symmetric arch — and is silent by the end.
    expect(exhaleGain().setValueAtTime).toHaveBeenCalledWith(0, 6);
    expect(valueAt(7)).toBeCloseTo(EXHALE_PEAK, 6);
    expect(valueAt(12)).toBe(0);
    // Well past its crest by the midpoint, where an arch would still be at full.
    expect(valueAt(9)).toBeLessThan(EXHALE_PEAK * 0.75);
  });

  it("leaves the exhale accent out of an inhale", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("simple", 1), true));

    const duringInhale = (
      exhaleGain().linearRampToValueAtTime.mock.calls as [number, number][]
    ).filter(([value, time]) => time < 6 && value > 0);
    expect(duringInhale).toEqual([]);
  });

  it("never sounds the hold voice for a technique that does not hold", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("relax", 3), true));

    expect(holdGain().linearRampToValueAtTime).not.toHaveBeenCalled();
  });

  it("swells the hold voice through each hold", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("box", 1), true));

    // Box holds 5s from t=5s, so the arch peaks at 7.5s and closes at 10s.
    expect(holdGain().linearRampToValueAtTime).toHaveBeenCalledWith(
      HOLD_PEAK,
      7.5,
    );
    expect(holdGain().linearRampToValueAtTime).toHaveBeenCalledWith(0, 10);
  });

  it("fades out through the master and releases the context on the way out", () => {
    const { unmount } = renderHook(() =>
      useBreathAudio(buildBreathePlan("box", 1), true),
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

  it("silences a run that is tapped away rather than finished", () => {
    const plan = buildBreathePlan("simple", 3);
    const { rerender } = renderHook<void, { running: boolean }>(
      ({ running }) => useBreathAudio(plan, running),
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
      () => useBreathAudio(plan, true),
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

  it("starts a fresh context when Begin is pressed again", () => {
    const { rerender } = renderHook<void, { plan: TBreathePlan }>(
      ({ plan }) => useBreathAudio(plan, true),
      { initialProps: { plan: buildBreathePlan("simple", 1) } },
    );

    // A fresh plan object per press is what re-triggers the run.
    rerender({ plan: buildBreathePlan("simple", 1) });

    expect(mockAudioContext).toHaveBeenCalledTimes(2);
  });
});
