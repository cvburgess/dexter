import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
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

/**
 * The pitch of the breath itself, in hertz.
 *
 * 432Hz because that is what Calm uses. It is low enough to sit under thought
 * rather than demand attention, which is the whole job.
 */
const BASE_HZ = 432;

/**
 * The hold's pitch, a perfect fifth above the breath.
 *
 * A fifth rather than an octave or a second: it is consonant enough not to read
 * as a wrong note over the breath's own tail, and far enough away to be heard as
 * a *different* voice rather than the same one getting louder. That distinction
 * is the point — a hold has to sound held, not merely sustained.
 */
const HOLD_HZ = BASE_HZ * 1.5;

/**
 * How far the breath's pitch rises across an inhale, as a ratio.
 *
 * DEX-167's value. Small on purpose: it is meant to be felt as the breath
 * lifting rather than heard as a melody, and anything larger starts sounding
 * like a siren over a six-second inhale.
 */
const PITCH_SWEEP = 1.04;

/**
 * The loudest each voice gets.
 *
 * **Read these as decibels, not percentages** — `gain` is linear amplitude while
 * hearing is roughly logarithmic, so halving a number here is only −6dB and
 * sounds far less than half as quiet. `useHoroscopeAudio` has the full ladder;
 * the short version is that perceived loudness roughly halves every −10dB.
 *
 * Higher than that track's `0.1`, and deliberately: the horoscope's ambience is
 * meant to be noticed only when it stops, whereas these tones *are* the
 * exercise — with your eyes closed they are the only thing pacing you. The hold
 * sits below the breath so it reads as a suspension rather than a third beat.
 */
const PEAK = 0.25;
const HOLD_PEAK = 0.15;

/**
 * How long the tones take to disappear when a run ends or the step goes away.
 *
 * The same shape as `useHoroscopeAudio`'s exit fade and for the same reason: a
 * cut reads as the app having failed, a fade reads as leaving. Shorter than that
 * one because a breath tone is a note rather than a piece of music, and holding
 * it after the user has tapped away just follows them.
 */
const EXIT_FADE_MS = 600;

/** A voice: an oscillator, its gain, and the peak that gain is scaled to. */
type TVoice = {
  oscillator: OscillatorNode;
  gain: GainNode;
  peak: number;
};

/**
 * Sounds a breathing run: a tone that swells with the inhale and recedes with
 * the exhale, and a second one that marks each hold (DEX-167).
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
export function useBreathAudio(plan: TBreathePlan | null, running: boolean) {
  useFocusEffect(
    useCallback(() => {
      if (!plan || !running) return;

      const context = new AudioContext();
      const startedAt = context.currentTime;
      const at = (ms: number) => startedAt + ms / 1000;

      const createVoice = (hz: number, peak: number): TVoice => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(hz, startedAt);
        // Silent until the schedule opens it, so nothing is audible between
        // starting the oscillator and its first ramp.
        gain.gain.setValueAtTime(0, startedAt);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startedAt);
        return { oscillator, gain, peak };
      };

      const voices: Record<TBreathAudioVoice, TVoice> = {
        breath: createVoice(BASE_HZ, PEAK),
        hold: createVoice(HOLD_HZ, HOLD_PEAK),
      };

      for (const step of buildBreathAudioSchedule(plan)) {
        const { gain, oscillator, peak } = voices[step.voice];
        const time = at(step.atMs);

        if (step.kind === "set") {
          gain.gain.setValueAtTime(step.value * peak, time);
        } else {
          gain.gain.linearRampToValueAtTime(step.value * peak, time);
        }

        // The sweep rides the gain's own schedule rather than getting one of
        // its own. The breath voice's gain is the fill level, so its every
        // entry already sits on a leg boundary — and following the same
        // `set`/`ramp` split matters as much here as it does for gain, since an
        // unanchored frequency ramp would glide the pitch down across a hold.
        if (step.voice !== "breath") continue;
        const hz = BASE_HZ * (1 + (PITCH_SWEEP - 1) * step.value);
        if (step.kind === "set") {
          oscillator.frequency.setValueAtTime(hz, time);
        } else {
          oscillator.frequency.linearRampToValueAtTime(hz, time);
        }
      }

      return () => {
        const now = context.currentTime;
        const endsAt = now + EXIT_FADE_MS / 1000;

        for (const voice of Object.values(voices)) {
          // `cancelAndHoldAtTime` rather than `cancelScheduledValues`: the
          // former keeps the value the run had reached, so the fade starts from
          // where the tone actually is. The latter would drop it to the last
          // *set* value first, which is an audible jump on the way out.
          voice.gain.gain.cancelAndHoldAtTime(now);
          voice.gain.gain.linearRampToValueAtTime(0, endsAt);
          voice.oscillator.stop(endsAt);
        }

        // Closing tears the graph down wherever it has got to, so it has to wait
        // out the fade it would otherwise cut short. Scheduled against the same
        // clock the fade is, then handed to a timer only because `close()` has
        // no scheduled form.
        setTimeout(() => {
          void context.close();
        }, EXIT_FADE_MS);
      };
    }, [plan, running]),
  );
}
