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

/**
 * The track. `require` rather than an `import`, and typed at the call site
 * rather than by an ambient `declare module "*.m4a"` — `tsconfig`'s `paths`
 * maps `@/*` onto real files, and TypeScript only consults an ambient wildcard
 * for a specifier it could *not* resolve, so the wildcard never fires and the
 * import fails to parse the binary instead. See `global.d.ts`.
 */
const TRACK = require<number>("@/assets/sounds/horoscope.m4a");

/**
 * What the decoder is handed, per platform. The `require()` module id above is
 * native-only: `react-native-web`'s `Image` does not export
 * `resolveAssetSource`, so the web decoder throws a `TypeError` for a number.
 * `expo-asset` resolves the id to a URL, which the web decoder can fetch.
 */
const DECODE_INPUT: number | string =
  Platform.OS === "web" ? Asset.fromModule(TRACK).uri : TRACK;

/**
 * The track, decoded once at module scope so re-entering the step never
 * re-decodes. `AudioBuffer` is not context-bound, so the cached buffer outlives
 * the contexts that play it. It being a promise is the one thing the hook must
 * defend against: focus can blur while it is still settling (see `cancelled`).
 */
const trackBuffer = decodeAudioData(DECODE_INPUT);

/**
 * How long before the track's own end the volume starts falling away.
 *
 * The recording ends on a cut rather than a decay, which reads as the app
 * having been interrupted. Riding it down over the last few seconds turns the
 * same ending into a settle.
 */
const TAIL_FADE_MS = 5000;

/**
 * How long the track takes to disappear when the step goes away.
 *
 * Shorter than the tail on purpose. The tail is the piece finishing on its own
 * terms and can take its time; this one is a response to the reader having
 * already left, and anything slower follows them onto the next screen.
 */
const EXIT_FADE_MS = 2000;

/**
 * The loudest the track ever gets.
 *
 * It is ambience behind a reading, not a song. **Every volume in here is a
 * fraction of this rather than of 1** — the fades below scale by it, so
 * lowering this number quiets the whole thing without flattening either fade's
 * shape.
 *
 * **Read this as decibels, not as a percentage**, or the dial feels broken.
 * `volume` is linear amplitude while hearing is roughly logarithmic: halving it
 * to 0.5 is only −6dB, which is audible but nowhere near half as loud, and the
 * first attempt at "quieter" landed there and was reported as unchanged.
 * Perceived loudness roughly halves every −10dB, so the useful ladder is 0.32
 * (−10dB, half), 0.2 (−14dB, a third), 0.1 (−20dB, a quarter). This sits at the
 * bottom of it — the track is meant to be noticed only once it stops.
 */
const MAX_VOLUME = 0.1;

/**
 * The context currently fading out, if one is.
 *
 * **Module scope rather than a ref, and it has to be.** The exit fade outlives
 * the thing that started it: come back inside those two seconds and the old
 * context is still going, so starting a new one lays the same track over
 * itself at two different positions — an echo, not ambience. A ref would catch
 * the blur-then-focus case, where the component instance is the same, but not
 * the swipe-away-and-back one, where `SwipeablePage` has remounted the step and
 * the new instance's ref is empty. Only one thing on screen ever plays this, so
 * one module-level slot is the whole state.
 */
let fadingOut: {
  context: AudioContext;
  timer: ReturnType<typeof setTimeout>;
} | null = null;

/**
 * Ends any fade still in flight, at once.
 *
 * Closing a context mid-fade is safe here precisely because it is mid-*fade*:
 * it is at `MAX_VOLUME` at the very loudest, and the track replacing it opens
 * at exactly that level, so the seam is covered rather than heard.
 */
const stopFadingOut = () => {
  if (!fadingOut) return;

  clearTimeout(fadingOut.timer);
  void fadingOut.context.close();
  fadingOut = null;
};

/**
 * Plays the Horoscope step's track for as long as the step is on screen.
 *
 * **The graph is `AudioContext` → `AudioBufferSourceNode` → `GainNode` →
 * destination**, the same shape as `useBreathAudio`, and both fades are
 * scheduled ramps on the audio clock rather than `setInterval` writes: the
 * tail lands on the end of the buffer, and the exit is a `cancelAndHoldAtTime`
 * plus a ramp scheduled when the step goes away. Nothing ticks while the track
 * plays, so nothing can drift off the audio.
 *
 * **Decoded once at module scope**, so a re-entry starts immediately rather
 * than re-decoding ~6MB of PCM.
 *
 * **`useFocusEffect`, not `useEffect`.** A tab navigator keeps its screens
 * mounted when you switch away, so an unmount-scoped effect never cleans up and
 * the track follows the reader to Today or Settings and plays on over it. Focus
 * is the lifetime that actually matches "while this step is on screen": it
 * fires the same cleanup on blur as on unmount, so leaving by tab fades exactly
 * like leaving by swipe.
 *
 * **The fades work in a browser on iOS, which the media player they replaced
 * could not do.** Apple reserves `HTMLMediaElement.volume` for the hardware
 * buttons and ignores writes to it, so the old player on iPhone or iPad web
 * ran at device volume and *cut* rather than fading. A `GainNode` is not
 * subject to that rule. Native and desktop browsers were unaffected before and
 * still are.
 *
 * Deliberately **not** looping, and deliberately not gated on a preference:
 * there is no "sounds" setting to hang it off yet. iOS's default audio mode is
 * respected, so a phone on silent stays silent — `utils/audio.ts` turns off
 * session management, and nothing here turns it back on.
 */
export function useHoroscopeAudio(enabled: boolean) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      // Before anything is created, so at most one track is ever audible.
      stopFadingOut();

      // Focus can blur while the decode is still settling — only the first
      // entry pays for it, but that first entry is exactly when the step is
      // most likely to be swiped away. `useFocusEffect`'s callback cannot
      // await, so the cleanup below flags this instead, and the continuation
      // checks it before creating anything — otherwise a blur during the
      // first load leaves a source running with no cleanup registered.
      let cancelled = false;
      let context: AudioContext | null = null;
      let source: AudioBufferSourceNode | null = null;
      let gain: GainNode | null = null;

      void trackBuffer
        .then((buffer) => {
          if (cancelled) return;

          context = new AudioContext();
          const startedAt = context.currentTime;
          const endsAt = startedAt + buffer.duration;

          source = context.createBufferSource();
          source.buffer = buffer;

          gain = context.createGain();
          // Hold the ceiling from the start (a fresh gain defaults to 1), then
          // anchor it again where the tail begins — a ramp runs from the
          // previous event, so without the second set it would slope over the
          // whole track instead of the last seconds.
          gain.gain.setValueAtTime(MAX_VOLUME, startedAt);
          gain.gain.setValueAtTime(
            MAX_VOLUME,
            Math.max(startedAt, endsAt - TAIL_FADE_MS / 1000),
          );
          gain.gain.linearRampToValueAtTime(0, endsAt);

          source.connect(gain);
          gain.connect(context.destination);
          source.start(startedAt);
        })
        .catch((error) => {
          // A failed decode degrades to silence — the step is ambience, not
          // functionality — but an unhandled rejection would surface in every
          // session that hits it, for nothing.
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
