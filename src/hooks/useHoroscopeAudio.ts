import { AudioPlayer, AudioSource, createAudioPlayer } from "expo-audio";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

/**
 * The track. `require` rather than an `import`, and typed at the call site
 * rather than by an ambient `declare module "*.m4a"` — `tsconfig`'s `paths`
 * maps `@/*` onto real files, and TypeScript only consults an ambient wildcard
 * for a specifier it could *not* resolve, so the wildcard never fires and the
 * import fails to parse the binary instead. See `global.d.ts`.
 */
const TRACK = require<AudioSource>("@/assets/sounds/horoscope.m4a");

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

/** How often either fade recomputes. 20fps — inaudible as steps, and cheap. */
const TICK_MS = 50;

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

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The player currently fading out, if one is.
 *
 * **Module scope rather than a ref, and it has to be.** The exit fade outlives
 * the thing that started it: come back inside those two seconds and the old
 * player is still going, so starting a new one lays the same track over itself
 * at two different positions — an echo, not ambience. A ref would catch the
 * blur-then-focus case, where the component instance is the same, but not the
 * swipe-away-and-back one, where `SwipeablePage` has remounted the step and the
 * new instance's ref is empty. Only one thing on screen ever plays this, so one
 * module-level slot is the whole state.
 */
let fadingOut: {
  player: AudioPlayer;
  timer: ReturnType<typeof setInterval>;
} | null = null;

/**
 * Ends any fade still in flight, at once.
 *
 * Cutting a player mid-fade is safe here precisely because it is mid-*fade*: it
 * is at `MAX_VOLUME` at the very loudest, and the track replacing it opens at
 * exactly that level, so the seam is covered rather than heard.
 */
const stopFadingOut = () => {
  if (!fadingOut) return;

  clearInterval(fadingOut.timer);
  fadingOut.player.remove();
  fadingOut = null;
};

/**
 * Plays the Horoscope step's track for as long as the step is on screen.
 *
 * **Built on `createAudioPlayer` rather than the `useAudioPlayer` hook, and the
 * difference is the whole point.** That hook releases its player the moment the
 * component unmounts, which cuts the audio dead mid-note — there is no window
 * left in which to fade anything. Owning the player means the cleanup can ride
 * the volume down over `EXIT_FADE_MS` and only then release it, so leaving the
 * step sounds like leaving rather than like a failure.
 *
 * That also means **this hook, not React, owns the lifetime**: every path out
 * has to end in `remove()`, or the player outlives the screen and keeps
 * playing to nobody.
 *
 * The tail fade reads `currentTime` off the player each tick rather than
 * counting up from when playback started. It is self-correcting that way —
 * timer drift, a slow first frame, or the player taking a moment to actually
 * begin all leave the fade landing on the end of the audio rather than near it.
 *
 * **`useFocusEffect`, not `useEffect`.** A tab navigator keeps its screens
 * mounted when you switch away, so an unmount-scoped effect never cleans up and
 * the track follows the reader to Today or Settings and plays on over it. Focus
 * is the lifetime that actually matches "while this step is on screen": it
 * fires the same cleanup on blur as on unmount, so leaving by tab fades exactly
 * like leaving by swipe.
 *
 * **None of the volume work happens in a browser on iOS.** Apple reserves
 * `HTMLMediaElement.volume` to the hardware buttons and ignores writes to it,
 * so on an iPhone or iPad browser the track plays at device volume and *cuts*
 * at the end rather than fading — `expo-audio` logs a one-time warning saying
 * so. There is no workaround short of routing through the Web Audio API and its
 * own gain node. Native and desktop browsers are unaffected; this is worth
 * knowing before anyone reads a report of "the fade does nothing" as a bug in
 * the arithmetic here.
 *
 * Deliberately **not** looping, and deliberately not gated on a preference:
 * there is no "sounds" setting to hang it off yet. iOS's default audio mode is
 * respected, so a phone on silent stays silent — `expo-audio` only overrides
 * that if `setAudioModeAsync` asks it to, and nothing here does.
 */
export function useHoroscopeAudio(enabled: boolean) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      // Before anything is created, so at most one player is ever audible.
      stopFadingOut();

      const player = createAudioPlayer(TRACK);
      player.loop = false;
      player.volume = MAX_VOLUME;
      player.play();

      const tail = setInterval(() => {
        // `duration` is 0 until the track has loaded; dividing by it early
        // would silence the opening rather than leave it alone.
        if (!player.duration) return;
        const remainingMs = (player.duration - player.currentTime) * 1000;
        player.volume = MAX_VOLUME * clamp01(remainingMs / TAIL_FADE_MS);
      }, TICK_MS);

      return () => {
        clearInterval(tail);

        // Timestamped rather than accumulated: a 2s ramp built by adding up
        // `TICK_MS` drifts as soon as a tick runs late, and this one runs while
        // the app is busy tearing a screen down.
        const startedAt = Date.now();
        const from = player.volume;

        const exit = setInterval(() => {
          const progress = (Date.now() - startedAt) / EXIT_FADE_MS;

          if (progress >= 1) {
            // Cleared *before* `remove()`: touching `volume` on a released
            // player is a use-after-free, and one more tick is already queued.
            clearInterval(exit);
            player.remove();
            // Guarded: a re-entry may already have cleared this slot and put
            // its own player in it, and blanking that would strand it.
            if (fadingOut?.player === player) fadingOut = null;
            return;
          }

          player.volume = from * (1 - progress);
        }, TICK_MS);

        fadingOut = { player, timer: exit };
      };
    }, [enabled]),
  );
}
