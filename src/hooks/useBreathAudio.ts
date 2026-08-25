import { useFocusEffect } from "expo-router";
import { type RefObject, useCallback, useRef } from "react";
import {
  AudioContext,
  type GainNode,
  type OscillatorNode,
} from "react-native-audio-api";

import "@/utils/audio";
import {
  buildBreathAudioSchedule,
  easeInOut,
  easeOut,
  type TBreathAudioVoice,
  type TBreathePlan,
} from "@/utils/breathing";

// All A major, so any two that overlap are consonant. Registers step down
// through the cycle — hold, inhale, exhale, hold — so the breath reads as an arch.
const CHORD: Record<TBreathAudioVoice, readonly number[]> = {
  inhaleHold: [440, 554.37, 659.25], // A4  C#5 E5
  inhale: [220, 277.18, 329.63], //     A3  C#4 E4
  exhale: [110, 138.59, 164.81], //     A2  C#3 E3
  exhaleHold: [110, 164.81, 220], //    A2  E3  A3
};

// A sine has no harmonics for the lowpass to shape, and none for a phone speaker
// to infer a missing fundamental from — so only the top voice, which has neither problem, is one.
const WAVE = {
  inhaleHold: "sine",
  inhale: "triangle",
  // Harmonics fall off as 1/n rather than 1/n², so what survives the filter
  // below is a reedier tone: a different instrument, not a lower note.
  exhale: "sawtooth",
  exhaleHold: "triangle",
} as const;

// Two oscillators per note, this far either side of it. The slow beating between
// them is the warmth; much wider and it speeds up into roughness.
const DETUNE_CENTS = 4;

// Per voice, because how dark a voice is separates it better than pitch does.
// Not below 600 on the exhale: its fundamentals are all under 300Hz, so the harmonics are the note.
const LOWPASS_HZ: Record<TBreathAudioVoice, number> = {
  inhaleHold: 900,
  inhale: 900,
  exhale: 600,
  exhaleHold: 900,
};

// Generated on the JS thread at Begin, so shorter than DEX-167's ~6s. The first
// number to raise if the result wants more air.
const REVERB_SECONDS = 4;
const REVERB_DECAY = 2.5;
const REVERB_WET = 0.6;

// Read as decibels, not percentages: gain is linear amplitude against a
// logarithmic ear, so halving one of these is only −6dB.
const PEAK: Record<TBreathAudioVoice, number> = {
  inhaleHold: 0.1,
  inhale: 0.22,
  exhale: 0.22,
  exhaleHold: 0.18,
};

// A finished run settles for exactly as long as the reverb runs — the fade sits
// after the convolver, so anything shorter silences the room mid-decay.
const END_FADE_MS = REVERB_SECONDS * 1000;
const EXIT_FADE_MS = 1500;

// A finished run decays like a room, most of the drop early. A quit eases both
// ends instead, or its steepest moment lands right where the breather tapped.
const fadeShape = (finished: boolean) => (t: number) =>
  finished ? 1 - easeOut(t) : 1 - easeInOut(t);

// A fade has to be a curve too: one straight ramp holds up near full and then
// drops out from under a logarithmic ear.
const FADE_STEPS = 12;

// Module scope because a settle outlives the effect that started it, and nothing
// else could cut one short. Only one Breathe step is ever on screen.
let fadingOut: {
  context: AudioContext;
  timer: ReturnType<typeof setTimeout>;
} | null = null;

/** Ends any fade still in flight, at once. */
const stopFadingOut = () => {
  if (!fadingOut) return;

  clearTimeout(fadingOut.timer);
  void fadingOut.context.close();
  fadingOut = null;
};

/** A voice: its oscillators, the gain they share, and that gain's ceiling. */
type TVoice = {
  oscillators: OscillatorNode[];
  gain: GainNode;
  peak: number;
};

/**
 * Sounds a breathing run (DEX-167): a chord per phase, crossfading into each
 * other, so the turns are audible with your eyes shut.
 *
 * **The whole run is scheduled on the audio clock at Begin** and nothing runs
 * afterwards — no timer to drift over 200 seconds of Box, and nothing crossing
 * out of `BreatheFill`'s worklet.
 *
 * **`useFocusEffect`, not `useEffect`**, or the tones follow the breather to
 * another tab; and this hook owns the context, so every path out reaches
 * `close()`. Creating it inside a Begin press is also what satisfies the web
 * autoplay rule.
 *
 * Ungated, matching `useHoroscopeAudio`: there is no "sounds" setting yet.
 */
export function useBreathAudio(
  plan: TBreathePlan | null,
  running: boolean,
  /**
   * Whether the run now ending reached its last breath. A ref because the
   * cleanup that reads it closes over the render *before* the one that ended the
   * run, so a plain prop would still say `false` at the only moment it matters.
   */
  endedNaturally: RefObject<boolean>,
) {
  // Only the audio is focus-scoped; `BreatheFill` animates on regardless. So a
  // run returned to stays silent rather than restarting against a half-full fill.
  const scheduledFor = useRef<TBreathePlan | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!plan || !running) {
        scheduledFor.current = null;
        // Registered even here, so leaving after a run has ended still has
        // something to cut the settle with.
        return stopFadingOut;
      }
      if (scheduledFor.current === plan) return;
      scheduledFor.current = plan;

      // Before anything is created, so at most one run is ever audible.
      stopFadingOut();

      const context = new AudioContext();
      const startedAt = context.currentTime;
      const at = (ms: number) => startedAt + ms / 1000;

      // Everything lands here, so the fade takes the reverb tail with it.
      const master = context.createGain();
      master.gain.setValueAtTime(1, startedAt);
      master.connect(context.destination);

      const reverb = context.createConvolver();
      reverb.buffer = buildImpulseResponse(context);
      const wet = context.createGain();
      wet.gain.setValueAtTime(REVERB_WET, startedAt);
      reverb.connect(wet);
      wet.connect(master);

      const dry = context.createGain();
      dry.gain.setValueAtTime(1 - REVERB_WET, startedAt);
      dry.connect(master);

      const createVoice = (which: TBreathAudioVoice): TVoice => {
        const gain = context.createGain();
        // Silent until the schedule opens it.
        gain.gain.setValueAtTime(0, startedAt);
        gain.connect(dry);
        gain.connect(reverb);

        const lowpass = context.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(LOWPASS_HZ[which], startedAt);
        lowpass.connect(gain);

        const oscillators = CHORD[which].flatMap((hz) =>
          [-DETUNE_CENTS, DETUNE_CENTS].map((cents) => {
            const oscillator = context.createOscillator();
            oscillator.type = WAVE[which];
            oscillator.frequency.setValueAtTime(hz, startedAt);
            oscillator.detune.setValueAtTime(cents, startedAt);
            oscillator.connect(lowpass);
            oscillator.start(startedAt);
            return oscillator;
          }),
        );

        // Divided across the oscillators so a chord cannot sum past the ceiling
        // one note was set to.
        return { oscillators, gain, peak: PEAK[which] / oscillators.length };
      };

      const voices: Record<TBreathAudioVoice, TVoice> = {
        inhaleHold: createVoice("inhaleHold"),
        inhale: createVoice("inhale"),
        exhale: createVoice("exhale"),
        exhaleHold: createVoice("exhaleHold"),
      };

      for (const curve of buildBreathAudioSchedule(plan)) {
        const { gain, peak } = voices[curve.voice];
        const time = at(curve.atMs);
        const duration = curve.durationMs / 1000;
        // One curve event per pass instead of a ramp per step: the native
        // queue silently drops automation past 64 events on a param, and a
        // ramp schedule overran that by the third breath (DEX-187).
        gain.gain.setValueCurveAtTime(
          Float32Array.from(curve.values, (value) => value * peak),
          time,
          duration,
        );
      }

      return () => {
        const now = context.currentTime;
        const finished = endedNaturally.current;
        const fadeMs = finished ? END_FADE_MS : EXIT_FADE_MS;
        const endsAt = now + fadeMs / 1000;
        const shape = fadeShape(finished);

        // Starting from 1 is safe because nothing else automates the master.
        master.gain.cancelAndHoldAtTime(now);
        for (let step = 1; step <= FADE_STEPS; step += 1) {
          const t = step / FADE_STEPS;
          master.gain.linearRampToValueAtTime(
            shape(t),
            now + (endsAt - now) * t,
          );
        }

        for (const voice of Object.values(voices)) {
          for (const oscillator of voice.oscillators) oscillator.stop(endsAt);
        }

        // Closing tears the graph down wherever it is, so it waits out the fade.
        // A timer only because `close()` has no scheduled form.
        const timer = setTimeout(() => {
          void context.close();
          // A new run may already have claimed the slot.
          if (fadingOut?.context === context) fadingOut = null;
        }, fadeMs);

        fadingOut = { context, timer };
      };
    }, [endedNaturally, plan, running]),
  );
}

/**
 * The reverb's impulse response: decaying noise, which is how `Tone.Reverb`
 * builds one too. Two channels of *independent* noise, so the tail arrives
 * wider than the mono chord feeding it.
 */
function buildImpulseResponse(context: AudioContext) {
  const length = Math.floor(context.sampleRate * REVERB_SECONDS);
  const impulse = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < 2; channel += 1) {
    const samples = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      samples[i] =
        (Math.random() * 2 - 1) * Math.pow(1 - i / length, REVERB_DECAY);
    }
  }

  return impulse;
}
