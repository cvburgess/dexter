// The Horoscope step's night sky (DEX-128) — replaces a photo (one fixed
// sky, ~873KB heavier) so layers can twinkle individually and unit-test.

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
 * Deterministic PRNG (mulberry32) — Math.random would reshuffle the sky on
 * every re-render, the one thing a sky must not do.
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
 * One opacity animation per layer, not per star, is what keeps this cheap.
 * Size/brightness are cubed, not uniform — a uniform draw reads as noise.
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
    // Round-robin, not another random draw — keeps every layer non-empty;
    // an empty layer would animate nothing while still costing a timer.
    field[i % layers].push(star);
  }

  return field;
};
