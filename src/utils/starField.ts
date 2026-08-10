/**
 * The Horoscope step's night sky (DEX-128).
 *
 * Replaces the photograph that shipped first. A photo is one fixed sky that
 * can only be faded as a whole; drawn stars can twinkle individually, which is
 * the thing the panel actually wanted. It is also ~873KB smaller.
 *
 * React-free and deterministic so the layout is unit-testable without a native
 * host — the same split `ritualSteps.ts` uses.
 */

/** One star. `x`/`y` are percentages of the panel, so the field fits any size. */
export type TStar = {
  /** 0–100, a percentage of the panel's width. */
  x: number;
  /** 0–100, a percentage of the panel's height. */
  y: number;
  /** Radius in points — deliberately absolute, so stars stay round. */
  radius: number;
  /** The star's own brightness, before its layer's twinkle is applied. */
  opacity: number;
};

/**
 * A small deterministic PRNG (mulberry32).
 *
 * `Math.random` would reshuffle the sky on every render — stars would jump
 * around as the panel re-rendered, which is the one thing a sky must not do.
 * Seeded once at module load, the field is generated exactly the same way on
 * every launch and on every device, and the test can assert against it.
 */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const MIN_RADIUS = 0.6;
const MAX_RADIUS = 2.2;
const MIN_OPACITY = 0.25;

/**
 * Builds a star field, split into `layers` groups.
 *
 * Grouping is what keeps this cheap: every star in a layer shares one opacity
 * animation, so the whole sky costs `layers` animations rather than one per
 * star. With the layers on different periods the eye reads it as stars
 * twinkling independently, which is the only thing that matters here.
 *
 * Both size and brightness are cubed rather than uniform. A uniform draw gives
 * a field of near-identical mid-size dots that reads as noise or a texture; the
 * cube pushes most stars small and faint and leaves a handful bright, which is
 * what a real sky looks like.
 */
export const buildStarField = (
  count: number,
  layers: number,
  seed: number,
): TStar[][] => {
  const random = mulberry32(seed);
  const field: TStar[][] = Array.from({ length: layers }, () => []);

  for (let i = 0; i < count; i++) {
    const star: TStar = {
      x: random() * 100,
      y: random() * 100,
      radius: MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * random() ** 3,
      opacity: MIN_OPACITY + (1 - MIN_OPACITY) * random() ** 3,
    };
    // Dealt round-robin rather than by another random draw, so every layer
    // holds the same number of stars and none can come up empty — an empty
    // layer would animate nothing while still costing a timer.
    field[i % layers].push(star);
  }

  return field;
};
