import { useFocusEffect } from "expo-router";
import { type RefObject, useCallback, useRef } from "react";
import {
  AudioContext,
  AudioManager,
  type GainNode,
  type OscillatorNode,
} from "react-native-audio-api";

import {
  buildBreathAudioSchedule,
  type TBreathAudioVoice,
  type TBreathePlan,
} from "@/utils/breathing";

/**
 * Hands the iOS audio session back to the system, and it has to run before any
 * `AudioContext` exists — hence module scope rather than inside the hook.
 *
 * Two things want it. **The silent switch**: left to itself this library
 * configures `AVAudioSession` for playback, which plays *through* the switch, and
 * `useHoroscopeAudio` establishes the opposite rule — a phone on silent stays
 * silent. Disabling the management leaves iOS's own default category in charge,
 * which honors the switch. **And `expo-audio`**: the horoscope track is played by
 * a different library, and two of them configuring one session is the case this
 * method exists for.
 *
 * If a device ever turns out to play nothing at all, the fallback is
 * `setAudioSessionOptions({ iosCategory: "ambient" })` — also silenced by the
 * switch, but re-enabling this library's session management to get there.
 *
 * A no-op on web and Android.
 */
AudioManager.disableSessionManagement();

/*
 * ---------------------------------------------------------------------------
 * Tuning
 *
 * The first version of this was a single sine per voice with its pitch swept
 * upward across each inhale, taken from a minimal snippet of Calm's approach.
 * On a device it sounded like microphone feedback, and for two reasons worth
 * keeping written down.
 *
 * **A gliding pure sine is a test tone.** Continuous pitch movement with no
 * harmonics above it has no instrument to be mistaken for; the ear reads it as
 * equipment. The sweep is gone entirely — the swell already carries the breath,
 * and pitch does not need to say it a second time.
 *
 * **And the two voices were guaranteed to clash.** The hold's pitch was a fifth
 * above the breath's *resting* pitch, but the hold voice only ever sounds after
 * a full inhale, by which point the sweep had carried the breath 4% sharp. The
 * one moment both sounded together was the one moment they were ~90 cents out —
 * a near-semitone, which is acoustic roughness rather than harmony.
 *
 * What replaced it is a pad: a chord rather than a tone, detuned pairs rather
 * than single oscillators, and a long reverb. Of everything here the reverb does
 * the most work — space is most of the difference between an instrument and a
 * signal generator.
 * ---------------------------------------------------------------------------
 */

/**
 * The chord each voice sounds, in hertz — all A major, so any two that overlap
 * are consonant.
 *
 * The registers step down through the breath: the hold after an inhale is the
 * highest, then the inhale, then the exhale, then the hold after an exhale at
 * the bottom. Each hold continues the direction of the leg before it, so the
 * whole cycle reads as one arch up and back down.
 *
 * The exhale keeps the major third (C#) so it settles rather than saddens. The
 * bottom hold drops the third and is a bare octave and fifth — empty, which is
 * what the lungs are at that point.
 */
const CHORD: Record<TBreathAudioVoice, readonly number[]> = {
  inhaleHold: [440, 554.37, 659.25], // A4  C#5 E5
  inhale: [220, 277.18, 329.63], //     A3  C#4 E4
  exhale: [110, 138.59, 164.81], //     A2  C#3 E3
  exhaleHold: [110, 164.81, 220], //    A2  E3  A3
};

/**
 * The waveform each voice is built from.
 *
 * **Triangle rather than sine, and the lowpass depends on it**: a sine has no
 * harmonics, so there is nothing for a filter to take off and no body for it to
 * shape. It also carries the low voices on a phone speaker, which reproduces
 * almost nothing under ~300Hz — the ear infers a fundamental it cannot hear from
 * the harmonics above it, and a bare sine gives it nothing to work with.
 *
 * The top hold is the exception: nothing is below it and a sine reads glassier,
 * which sets the highest voice apart by timbre as well as by pitch.
 */
const WAVE = {
  inhaleHold: "sine",
  inhale: "triangle",
  // Sawtooth only here, and only because the filter below is closed most of the
  // way down on it. A saw's harmonics fall off as 1/n rather than 1/n², so what
  // survives is a reedier, hollower tone than anything a triangle makes — a
  // different instrument, not a lower note. It also carries far better on a
  // phone speaker, which reproduces none of these three fundamentals directly.
  exhale: "sawtooth",
  exhaleHold: "triangle",
} as const;

/**
 * How far each note's two oscillators are detuned from it, in cents.
 *
 * This is the whole reason a note is a *pair*. Two oscillators a few cents apart
 * beat against each other slowly — at 220Hz, eight cents of separation is about
 * one beat a second — and that drift is what a single oscillator cannot sound
 * like however it is filtered. Push it much past this and the beating speeds up
 * into the roughness this rewrite exists to remove.
 */
const DETUNE_CENTS = 4;

/**
 * Where each voice's lowpass opens, in hertz.
 *
 * Per voice rather than one filter for the graph, because how *dark* a voice is
 * turns out to separate two of them better than pitch does. 900 sits above every
 * chord's top note, so it shapes the harmonics rather than the notes.
 *
 * The exhale is the exception and is closed down to 600 — dark and a little
 * muffled, which is what breathing out sounds like, and enough on its own to
 * read as a different instrument from the bright triangle above it. Not lower
 * than 600: these fundamentals are all under 300Hz, where a phone speaker
 * reproduces nothing directly, so the harmonics between the two are the only
 * thing carrying the note at all.
 */
const LOWPASS_HZ: Record<TBreathAudioVoice, number> = {
  inhaleHold: 900,
  inhale: 900,
  exhale: 600,
  exhaleHold: 900,
};

/**
 * The reverb: how long the tail runs, how fast it decays into that, and how much
 * of the signal arrives through it.
 *
 * DEX-167 asked for ~6s of decay. This is shorter because the impulse response
 * is generated on the JS thread when Begin is pressed and convolution is not
 * free — four seconds is still a large room, and it is the one number to raise
 * first if the result wants more air.
 */
const REVERB_SECONDS = 4;
const REVERB_DECAY = 2.5;
const REVERB_WET = 0.6;

/**
 * The loudest each voice gets, before it is divided across its oscillators.
 *
 * **Read these as decibels, not percentages** — gain is linear amplitude while
 * hearing is roughly logarithmic, so halving a number here is only −6dB and
 * sounds far less than half as quiet. `useHoroscopeAudio` has the full ladder.
 *
 * Both accents sit below the breath: they mark a turn, and something that only
 * has to be *noticed* needs far less room than the tone you follow. The exhale
 * gets a little more than the hold because it arrives over a breath voice that
 * is still near full, where the hold arrives over one already holding steady.
 */
const PEAK: Record<TBreathAudioVoice, number> = {
  inhaleHold: 0.1,
  inhale: 0.22,
  exhale: 0.22,
  exhaleHold: 0.18,
};

/**
 * How long the tones take to disappear, and it depends on who ended the run —
 * the same split `useHoroscopeAudio` makes, for the same reason.
 *
 * A run that **reached its end** is the exercise finishing on its own terms, so
 * it can take its time: long enough for the last tone to release and for the
 * reverb to bloom out rather than be chopped off a fifth of the way through its
 * tail. That settle is the last thing the breather hears.
 *
 * A run that was **tapped away or swiped past** is a response to someone who has
 * already left, and anything slow follows them onto the next screen.
 *
 * Either way it rides a master gain *after* the reverb rather than the voices
 * before it, so the tail goes down with everything else.
 */
const END_FADE_MS = 2500;
const EXIT_FADE_MS = 600;

/** A voice: its oscillators, the gain they share, and that gain's ceiling. */
type TVoice = {
  oscillators: OscillatorNode[];
  gain: GainNode;
  peak: number;
};

/**
 * Sounds a breathing run (DEX-167): a pad that swells with the inhale and
 * recedes with the exhale, plus an accent on each turn — a suspended chord above
 * for a hold, a resolving one below for an exhale.
 *
 * **The accents are what make the run followable with your eyes shut.** A rise
 * and a fall of one chord are the same sound run backwards, which the screen
 * makes obvious and the ear very nearly misses, so each phase that *starts*
 * announces itself with its own voicing and its own envelope.
 *
 * **Everything is scheduled up front, on the audio clock.** `buildBreathAudioSchedule`
 * turns the plan into the run's every gain change before a note sounds, and this
 * hook does nothing afterwards but wait. There is no interval and no per-leg
 * callback, which matters twice over: the audio hardware clock cannot drift the
 * way a JS timer running alongside an animation does — ten Box breaths is 200
 * seconds — and nothing has to cross out of `BreatheFill`'s worklet, the boundary
 * `docs/testing.md` says no test can see.
 *
 * **`useFocusEffect`, not `useEffect`.** A tab navigator keeps its screens
 * mounted when you switch away, so an unmount-scoped effect would never clean up
 * and the tones would follow the breather to Today or Settings. Focus fires the
 * same cleanup on blur as on unmount, so leaving by tab sounds like leaving by
 * swipe.
 *
 * **This hook, not React, owns the context**: every path out has to reach
 * `close()`, or the oscillators outlive the screen and play to nobody.
 *
 * Creating the context inside the effect that a Begin press triggers is also
 * what satisfies the browser autoplay rule on web — an `AudioContext` may only
 * start from a user gesture, and Begin is one.
 *
 * Deliberately not gated on a preference, matching `useHoroscopeAudio`: there is
 * no "sounds" setting to hang it off yet.
 */
export function useBreathAudio(
  plan: TBreathePlan | null,
  running: boolean,
  /**
   * Whether the run now ending reached its last breath.
   *
   * **A ref rather than a boolean, and it has to be.** The cleanup below is what
   * reads it, and an effect cleanup closes over the render *before* the one that
   * ended the run — a plain prop would still say `false` at the only moment it
   * matters. The step assigns this inside the handler, before React re-renders.
   *
   * The audio clock cannot answer this instead, which was the first attempt: a
   * fresh `AudioContext` does not begin advancing `currentTime` the instant it
   * is constructed, so at the end of a run the clock reads a little short of
   * `totalMs` and every natural ending was mistaken for a quit.
   */
  endedNaturally: RefObject<boolean>,
) {
  // The plan whose sound has already been scheduled once.
  //
  // Blur fades the tones out, and coming back re-runs this effect — but only the
  // *audio* is focus-scoped. `BreatheFill` animates from a plain `useEffect`, so
  // a run left behind on another tab keeps going, and re-scheduling from the top
  // on return would open on the first inhale against a fill halfway through its
  // fourth. Staying silent for the rest of that run is the lesser wrong, and it
  // is the only one of the two that cannot be mistaken for the exercise itself.
  //
  // A ref rather than state: nothing renders differently for it. Pressing Begin
  // again builds a fresh plan object, which is what makes the next run audible.
  const scheduledFor = useRef<TBreathePlan | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!plan || !running) {
        scheduledFor.current = null;
        return;
      }
      if (scheduledFor.current === plan) return;
      scheduledFor.current = plan;

      const context = new AudioContext();
      const startedAt = context.currentTime;
      const at = (ms: number) => startedAt + ms / 1000;

      // Everything lands here, so the exit fade can take the reverb tail with it.
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
        // Silent until the schedule opens it, so nothing is audible between
        // starting the oscillators and the first ramp.
        gain.gain.setValueAtTime(0, startedAt);
        gain.connect(dry);
        gain.connect(reverb);

        // One filter per voice rather than one for the graph — see LOWPASS_HZ.
        const lowpass = context.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(LOWPASS_HZ[which], startedAt);
        lowpass.connect(gain);

        const oscillators = CHORD[which].flatMap((hz) =>
          // Two per note, detuned either side of it — see DETUNE_CENTS.
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
        // its single note was set to.
        return { oscillators, gain, peak: PEAK[which] / oscillators.length };
      };

      const voices: Record<TBreathAudioVoice, TVoice> = {
        inhaleHold: createVoice("inhaleHold"),
        inhale: createVoice("inhale"),
        exhale: createVoice("exhale"),
        exhaleHold: createVoice("exhaleHold"),
      };

      for (const step of buildBreathAudioSchedule(plan)) {
        const { gain, peak } = voices[step.voice];
        const time = at(step.atMs);

        if (step.kind === "set") {
          gain.gain.setValueAtTime(step.value * peak, time);
        } else {
          gain.gain.linearRampToValueAtTime(step.value * peak, time);
        }
      }

      return () => {
        const now = context.currentTime;
        const fadeMs = endedNaturally.current ? END_FADE_MS : EXIT_FADE_MS;
        const endsAt = now + fadeMs / 1000;

        // One fade, after the reverb, so the tail goes down with the voices
        // instead of ringing on into a closed context.
        master.gain.cancelAndHoldAtTime(now);
        master.gain.linearRampToValueAtTime(0, endsAt);

        for (const voice of Object.values(voices)) {
          for (const oscillator of voice.oscillators) oscillator.stop(endsAt);
        }

        // Closing tears the graph down wherever it has got to, so it has to wait
        // out the fade it would otherwise cut short. Handed to a timer only
        // because `close()` has no scheduled form.
        setTimeout(() => {
          void context.close();
        }, fadeMs);
      };
    }, [endedNaturally, plan, running]),
  );
}

/**
 * The reverb's impulse response: noise that decays to nothing.
 *
 * Convolving against decaying noise is the cheap, standard way to get a room
 * without shipping a recording of one, and it is what `Tone.Reverb` generates
 * internally. The exponent is the shape of the decay — raise it and the tail
 * disappears faster, which reads as a smaller room.
 *
 * Two channels of *independent* noise rather than one copied to both, which is
 * what makes the tail arrive wider than the mono chord feeding it.
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
