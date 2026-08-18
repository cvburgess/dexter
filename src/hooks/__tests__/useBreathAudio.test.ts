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

const END_FADE_MS = 2500;
const EXIT_FADE_MS = 600;

// Gains in the order the hook builds them: the master everything lands on, the
// reverb's wet and dry sides, then one per voice. Counted from the end rather
// than named individually, so adding or dropping a voice does not touch this.
const masterGain = () => mockGains[0].gain;
const voiceGains = () => mockGains.slice(3);

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
    renderHook(() => useBreathAudio(null, true));

    expect(mockAudioContext).not.toHaveBeenCalled();
  });

  it("makes no sound until the run starts", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("simple", 2), false));

    expect(mockAudioContext).not.toHaveBeenCalled();
  });

  // Deliberately thin on the sound itself: the chords, registers and envelopes
  // are still being tuned by ear, so anything pinning them would be rewritten
  // every pass. What is left is the lifecycle, which is not in flux.
  it("opens a voice per phase and leaves them all silent to start", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("box", 1), true));

    expect(mockOscillators.length).toBeGreaterThan(0);
    // One filter per voice, one reverb for all of them.
    expect(mockContext.createBiquadFilter).toHaveBeenCalledTimes(
      voiceGains().length,
    );
    expect(mockContext.createConvolver).toHaveBeenCalledTimes(1);

    for (const gain of voiceGains()) {
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    }
    expect(mockOscillators.every((o) => o.start.mock.calls.length === 1)).toBe(
      true,
    );
  });

  // The whole run goes onto the audio clock at Begin — there is no timer, so
  // nothing after this point can drift over a 200-second Box run.
  it("schedules against the context clock, wherever it already is", () => {
    mockContext.currentTime = 40;
    renderHook(() => useBreathAudio(buildBreathePlan("simple", 1), true));

    const times = voiceGains().flatMap((gain) =>
      (gain.gain.linearRampToValueAtTime.mock.calls as [number, number][]).map(
        ([, at]) => at,
      ),
    );
    expect(times.length).toBeGreaterThan(0);
    expect(Math.min(...times)).toBeGreaterThan(40);
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

  // A run that reached its end is the exercise finishing on its own terms, so
  // it gets long enough for the last tone and the reverb to settle. One that was
  // cut off is a response to someone who already left.
  it("takes longer to fade a run that finished than one that was cut off", () => {
    const plan = buildBreathePlan("simple", 1);
    const { unmount } = renderHook(() => useBreathAudio(plan, true));

    mockContext.currentTime = plan.totalMs / 1000;
    unmount();

    expect(masterGain().linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      plan.totalMs / 1000 + END_FADE_MS / 1000,
    );
    jest.advanceTimersByTime(EXIT_FADE_MS);
    expect(mockClose).not.toHaveBeenCalled();
    jest.advanceTimersByTime(END_FADE_MS);
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
