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
  createGain: jest.fn(() => {
    const gain = { connect: jest.fn(), gain: mockParam() };
    mockGains.push(gain);
    return gain;
  }),
  createOscillator: jest.fn(() => {
    const oscillator: TMockOscillator = {
      connect: jest.fn(),
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
// hook memoizes on `[plan, running]`, so "unmount" below stands for switching
// tabs and for swiping to the next step alike.
jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(() => effect(), [effect]);
    },
  };
});

// Mirror the hook's own constants rather than importing them — a test that
// reads the value it is checking cannot notice it changing.
const BASE_HZ = 432;
const HOLD_HZ = 648;
const PEAK = 0.25;
const EXIT_FADE_MS = 600;

/** The voice at `index`, in creation order: breath first, then hold. */
const gainOf = (index: number) => mockGains[index].gain;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockOscillators.length = 0;
  mockGains.length = 0;
  mockContext.currentTime = 0;
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

  it("opens two silent sine voices a fifth apart", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("box", 1), true));

    expect(mockOscillators).toHaveLength(2);
    expect(mockOscillators.every((o) => o.type === "sine")).toBe(true);
    expect(mockOscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(
      BASE_HZ,
      0,
    );
    expect(mockOscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(
      HOLD_HZ,
      0,
    );
    // Silent until the schedule opens them, so nothing sounds between starting
    // the oscillator and its first ramp.
    expect(gainOf(0).setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(gainOf(1).setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(mockOscillators.every((o) => o.start.mock.calls.length === 1)).toBe(
      true,
    );
  });

  // The whole run goes onto the audio clock at Begin — there is no timer, so
  // nothing after this point can drift over a 200-second Box run.
  it("schedules the entire run up front, in seconds from the context clock", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("simple", 1), true));

    // Simple is inhale 6s then exhale 6s.
    expect(gainOf(0).linearRampToValueAtTime).toHaveBeenCalledWith(PEAK, 6);
    expect(gainOf(0).linearRampToValueAtTime).toHaveBeenCalledWith(0, 12);
    expect(gainOf(0).setValueAtTime).toHaveBeenCalledWith(PEAK, 6);
  });

  it("offsets the schedule from wherever the context clock already is", () => {
    mockContext.currentTime = 40;
    renderHook(() => useBreathAudio(buildBreathePlan("simple", 1), true));

    expect(gainOf(0).linearRampToValueAtTime).toHaveBeenCalledWith(PEAK, 46);
    expect(gainOf(0).linearRampToValueAtTime).toHaveBeenCalledWith(0, 52);
  });

  it("sweeps the breath's pitch up with the inhale and back down", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("simple", 1), true));

    const sweep = mockOscillators[0].frequency.linearRampToValueAtTime;
    expect(sweep).toHaveBeenCalledWith(BASE_HZ * 1.04, 6);
    expect(sweep).toHaveBeenCalledWith(BASE_HZ, 12);
  });

  it("never sounds the hold voice for a technique that does not hold", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("relax", 3), true));

    expect(gainOf(1).linearRampToValueAtTime).not.toHaveBeenCalled();
  });

  it("swells the hold voice through each hold", () => {
    renderHook(() => useBreathAudio(buildBreathePlan("box", 1), true));

    // Box holds 5s from t=5s, so the swell peaks at 7.5s and closes at 10s.
    expect(gainOf(1).linearRampToValueAtTime).toHaveBeenCalledWith(0.15, 7.5);
    expect(gainOf(1).linearRampToValueAtTime).toHaveBeenCalledWith(0, 10);
  });

  it("fades both voices out and releases the context on the way out", () => {
    const { unmount } = renderHook(() =>
      useBreathAudio(buildBreathePlan("box", 1), true),
    );

    unmount();

    for (const index of [0, 1]) {
      // Held at where the run had actually reached, so the fade does not jump
      // before it starts.
      expect(gainOf(index).cancelAndHoldAtTime).toHaveBeenCalledWith(0);
      expect(gainOf(index).linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        EXIT_FADE_MS / 1000,
      );
    }
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

    expect(gainOf(0).cancelAndHoldAtTime).toHaveBeenCalled();
    jest.advanceTimersByTime(EXIT_FADE_MS);
    expect(mockClose).toHaveBeenCalled();
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
