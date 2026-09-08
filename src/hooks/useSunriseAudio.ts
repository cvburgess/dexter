import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import {
  AudioContext,
  type GainNode,
  type OscillatorNode,
} from "react-native-audio-api";

import { BAND_WINDOWS, SUNRISE_MS } from "@/components/SunriseBackground";
import "@/utils/audio";

// Matches SummaryStep's CONTENT_FADE_MS — the figures' own fade. Not imported
// from there: that module imports this one, and a cycle costs more than a copy.
const SETTLE_MS = 1800;

// C major, ascending, one note per band — arriving in order they arpeggiate up
// and accumulate into the chord. A harmonic stack read as an ominous drone.
const NOTES = [261.63, 329.63, 392.0, 523.25, 659.25]; // C4 E4 G4 C5 E5

// Triangle for the two that carry the body, sine above: at C5 and up a
// triangle's harmonics land where the ear is sharpest and read as glare.
const WAVE = (index: number) => (index < 2 ? "triangle" : "sine");

// Two oscillators per note, this far either side. The slow beating between
// them is the warmth; much wider and it speeds up into roughness.
const DETUNE_CENTS = 4;

// Swept across the rise, not fixed: light arriving reads as a spectrum opening,
// which is the one sunrise-shaped gesture available without a sample.
const LOWPASS_FROM_HZ = 800;
const LOWPASS_TO_HZ = 4000;

// Read as decibels, not a percentage: gain is linear amplitude against a
// logarithmic ear, so halving this is only −6dB. Same register as the horoscope.
const MAX_VOLUME = 0.1;

// 1/√n, not 1/n: the top of a chord has to stay audible as a note, where an
// overtone could fall away. Some taper still, or the ear reads the top as shrill.
const WEIGHTS = NOTES.map((_, index) => 1 / Math.sqrt(index + 1));
const WEIGHT_SUM = WEIGHTS.reduce((sum, weight) => sum + weight, 0);

// Shorter than the settle on purpose: this answers someone who has already
// swiped away, so anything slower follows them onto the next step.
const EXIT_FADE_MS = 1200;

// A start time already in the past gets clamped to now, stretching a curve into
// the next one's boundary — which throws. A beat of lead-in avoids that.
const LEAD_IN_SECONDS = 0.05;

const easeOut = (t: number) => Math.sin((Math.PI / 2) * t);
const easeInOut = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

// Enough to read as a curve rather than a staircase, and far inside the
// library's 64-event-per-param budget (DEX-187) since each curve is one event.
const CURVE_STEPS = 24;

// Stepped ramps, not a `setValueCurveAtTime`: the exit fade cancelAndHolds the
// master mid-flight, and the library rejects an event inside a curve's span.
const SETTLE_STEPS = 16;
const FADE_STEPS = 12;

const sample = (shape: (t: number) => number) =>
  Float32Array.from({ length: CURVE_STEPS + 1 }, (_, step) =>
    shape(step / CURVE_STEPS),
  );

/** Rides a param from `level` down along `shape`, in `steps` linear ramps. */
const rideDown = (
  param: GainNode["gain"],
  shape: (t: number) => number,
  from: number,
  seconds: number,
  level: number,
  steps: number,
) => {
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    param.linearRampToValueAtTime(shape(t) * level, from + seconds * t);
  }
};

// The settle drops early, like a room letting go; the fade eases both ends, or
// its steepest moment lands right where the reader swiped away.
const SETTLE_SHAPE = (t: number) => 1 - easeOut(t);
const FADE_SHAPE = (t: number) => 1 - easeInOut(t);

/** Where the envelope sits, as a fraction of its peak, `ms` in. */
const levelAt = (ms: number) => {
  if (ms <= SUNRISE_MS) return 1;
  return SETTLE_SHAPE(Math.min(1, (ms - SUNRISE_MS) / SETTLE_MS));
};

// Module scope because a fade outlives the effect that started it, and nothing
// else could cut one short. Only one Summary step is ever on screen.
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

// Sounds the Summary step's sunrise (DEX-198). `revealKey` is the day, or null
// to stay silent — the caller owns the gating; see SummaryStep.
export function useSunriseAudio(revealKey: string | null) {
  // Coming back from another tab finds `rise` already settled, so a replay
  // would swell at a static sky. Swiping in remounts, which clears this.
  const scheduledFor = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!revealKey) {
        scheduledFor.current = null;
        // Registered even here, so leaving after the envelope has finished
        // still has something to cut a fade with.
        return stopFadingOut;
      }
      if (scheduledFor.current === revealKey) return;
      scheduledFor.current = revealKey;

      // Before anything is created, so at most one sunrise is ever audible.
      stopFadingOut();

      const context = new AudioContext();
      const startedAt = context.currentTime + LEAD_IN_SECONDS;
      const at = (ms: number) => startedAt + ms / 1000;
      const endsAt = at(SUNRISE_MS + SETTLE_MS);

      // Everything lands here, so one hold-and-ramp on the way out covers the
      // whole stack rather than five envelopes racing each other down.
      const master = context.createGain();
      master.gain.setValueAtTime(MAX_VOLUME, startedAt);
      // Anchored again where the settle begins — a ramp runs from the previous
      // event, so without this the descent would slope across the whole swell.
      master.gain.setValueAtTime(MAX_VOLUME, at(SUNRISE_MS));
      rideDown(
        master.gain,
        SETTLE_SHAPE,
        at(SUNRISE_MS),
        SETTLE_MS / 1000,
        MAX_VOLUME,
        SETTLE_STEPS,
      );
      master.connect(context.destination);

      const lowpass = context.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(LOWPASS_FROM_HZ, startedAt);
      lowpass.frequency.linearRampToValueAtTime(LOWPASS_TO_HZ, at(SUNRISE_MS));
      lowpass.connect(master);

      const oscillators: OscillatorNode[] = [];

      NOTES.forEach((hz, index) => {
        const [from, to] = BAND_WINDOWS[index];

        const gain = context.createGain();
        // Skipped where the curve already opens here: an event on a curve's
        // own start is a span conflict, and its first sample is zero anyway.
        if (from > 0) gain.gain.setValueAtTime(0, startedAt);
        gain.connect(lowpass);

        for (const cents of [-DETUNE_CENTS, DETUNE_CENTS]) {
          const oscillator = context.createOscillator();
          oscillator.type = WAVE(index);
          oscillator.frequency.setValueAtTime(hz, startedAt);
          oscillator.detune.setValueAtTime(cents, startedAt);
          oscillator.connect(gain);
          oscillator.start(startedAt);
          oscillators.push(oscillator);
        }

        // Halved across the detune pair, so a note cannot sum past the
        // share of MAX_VOLUME its weight bought it.
        const peak = WEIGHTS[index] / WEIGHT_SUM / 2;
        gain.gain.setValueCurveAtTime(
          sample((t) => easeInOut(t) * peak),
          at(from * SUNRISE_MS),
          ((to - from) * SUNRISE_MS) / 1000,
        );
      });

      return () => {
        const now = context.currentTime;
        const stopsAt = Math.min(endsAt, now + EXIT_FADE_MS / 1000);

        // cancelAndHold leaves the opening ceiling as the last event, so an
        // unanchored ramp would slope from full — a jump, not a fade.
        master.gain.cancelAndHoldAtTime(now);
        const level = MAX_VOLUME * levelAt((now - startedAt) * 1000);
        master.gain.setValueAtTime(level, now);
        rideDown(
          master.gain,
          FADE_SHAPE,
          now,
          EXIT_FADE_MS / 1000,
          level,
          FADE_STEPS,
        );

        // Clamped: past the natural end the oscillators have already stopped,
        // and re-stopping a finished node is not the library's happy path.
        for (const oscillator of oscillators) oscillator.stop(stopsAt);

        // Closing tears the graph down wherever it is, so it waits out the
        // fade. A timer only because `close()` has no scheduled form.
        const timer = setTimeout(() => {
          void context.close();
          // A new sunrise may already have claimed the slot.
          if (fadingOut?.context === context) fadingOut = null;
        }, EXIT_FADE_MS);

        fadingOut = { context, timer };
      };
    }, [revealKey]),
  );
}
