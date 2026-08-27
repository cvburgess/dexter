import { Asset } from "expo-asset";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Platform } from "react-native";
import {
  AudioContext,
  type AudioBufferSourceNode,
  type GainNode,
  decodeAudioData,
} from "react-native-audio-api";

import "@/utils/audio";

// `require`, not an ambient `declare module` — tsconfig's paths already
// resolve `@/*`, so the ambient wildcard never fires. See global.d.ts.
const TRACK = require<number>("@/assets/sounds/horoscope.m4a");

// The native require() id is a number; react-native-web's decoder throws a
// TypeError on that, so web resolves it to a URL via expo-asset first.
const DECODE_INPUT: number | string =
  Platform.OS === "web" ? Asset.fromModule(TRACK).uri : TRACK;

// Decoded once at module scope so re-entry never re-decodes; being a promise
// is what the hook must guard against via `cancelled` if focus blurs first.
const trackBuffer = decodeAudioData(DECODE_INPUT);

// The recording ends on a cut, which reads as an interruption; riding the
// volume down over the last few seconds turns it into a settle instead.
const TAIL_FADE_MS = 5000;

// Shorter than the tail on purpose — this is a response to the reader having
// already left, so anything slower follows them onto the next screen.
const EXIT_FADE_MS = 2000;

// Read as decibels, not a percentage: halving to 0.5 is only −6dB, barely
// audible as quieter. 0.32/0.2/0.1 roughly halve perceived loudness each step.
const MAX_VOLUME = 0.1;

// Module scope, not a ref: the exit fade outlives the instance that started
// it (a SwipeablePage remount empties a fresh ref).
let fadingOut: {
  context: AudioContext;
  timer: ReturnType<typeof setTimeout>;
} | null = null;

// Safe mid-fade: it's at MAX_VOLUME at the loudest, and the replacing track
// opens at exactly that level, so the seam is covered rather than heard.
const stopFadingOut = () => {
  if (!fadingOut) return;

  clearTimeout(fadingOut.timer);
  void fadingOut.context.close();
  fadingOut = null;
};

// useFocusEffect, not useEffect — a tab navigator keeps screens mounted, so
// unmount-scoped cleanup would let the track follow to another tab.
export function useHoroscopeAudio(enabled: boolean) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      // Before anything is created, so at most one track is ever audible.
      stopFadingOut();

      // The callback can't await, so a blur mid-decode sets the flag the
      // continuation checks before creating anything.
      let cancelled = false;
      let context: AudioContext | null = null;
      let source: AudioBufferSourceNode | null = null;
      let gain: GainNode | null = null;
      // Zero only before the decode settles — exactly when the guard above
      // already covers the cleanup reading it.
      let trackEndsAt = 0;

      void trackBuffer
        .then((buffer) => {
          if (cancelled) return;

          context = new AudioContext();
          const startedAt = context.currentTime;
          trackEndsAt = startedAt + buffer.duration;

          source = context.createBufferSource();
          source.buffer = buffer;

          gain = context.createGain();
          // Anchor again where the tail begins — a ramp runs from the
          // previous event, so without it the slope covers the whole track.
          gain.gain.setValueAtTime(MAX_VOLUME, startedAt);
          gain.gain.setValueAtTime(
            MAX_VOLUME,
            Math.max(startedAt, trackEndsAt - TAIL_FADE_MS / 1000),
          );
          gain.gain.linearRampToValueAtTime(0, trackEndsAt);

          source.connect(gain);
          gain.connect(context.destination);
          source.start(startedAt);
        })
        .catch((error) => {
          // Degrades to silence — the step is ambience, not functionality —
          // but caught, or an unhandled rejection surfaces for nothing.
          console.warn("Horoscope track failed to decode", error);
        });

      return () => {
        cancelled = true;
        if (!context || !source || !gain) return;

        // The track's own tail ramp is still scheduled; hold the gain where
        // the fade finds it and ride it down over the exit fade instead.
        const ctx = context;
        const now = ctx.currentTime;
        const endsAt = now + EXIT_FADE_MS / 1000;
        gain.gain.cancelAndHoldAtTime(now);
        // cancelAndHold leaves the t=0 ceiling as the last event, so an
        // unanchored ramp would slope from full and read as a cut, not a fade.
        gain.gain.setValueAtTime(
          MAX_VOLUME *
            Math.min(
              1,
              Math.max(0, (trackEndsAt - now) / (TAIL_FADE_MS / 1000)),
            ),
          now,
        );
        gain.gain.linearRampToValueAtTime(0, endsAt);
        source.stop(endsAt);

        // Closing tears the context down wherever it is, so it waits out the
        // fade. A timer only because `close()` has no scheduled form.
        const timer = setTimeout(() => {
          void ctx.close();
          // A new entry may already have claimed the slot.
          if (fadingOut?.context === ctx) fadingOut = null;
        }, EXIT_FADE_MS);

        fadingOut = { context: ctx, timer };
      };
    }, [enabled]),
  );
}
