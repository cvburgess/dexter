/**
 * The burst behind the Open tasks step's all-clear (DEX-146).
 *
 * React-free and deterministic so the field is unit-testable without a native
 * host — the same split `starField.ts` and `ritualSteps.ts` use. Everything here
 * is geometry in *fractions*; the component scales it to whatever box it is
 * given, so one field fits a phone and a capped-width desktop column alike.
 */

/** One piece of paper. */
export type TConfettiPiece = {
  /** 0–1, a fraction of the step's width — where the piece falls. */
  x: number;
  /** How far it drifts sideways on the way down, as a fraction of width. Signed. */
  drift: number;
  /** The piece's longest edge, in points — absolute, so paper stays paper. */
  size: number;
  /** Height as a fraction of `size`: a range of rectangles rather than squares. */
  ratio: number;
  /** Whole turns it makes on the way down. Signed, so the field spins both ways. */
  turns: number;
  /** 0–1, where in the burst it starts — see `CONFETTI_STAGGER`. */
  delay: number;
  /** Index into whatever palette the component is holding. */
  tint: number;
};

/**
 * A small deterministic PRNG (mulberry32), the same one `starField.ts` carries.
 *
 * `Math.random` would deal a new field on every render, and this one animates
 * while the step around it is still re-rendering (a task arriving from another
 * device re-runs the whole step) — pieces would teleport mid-fall.
 */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const MIN_SIZE = 6;
const MAX_SIZE = 12;
/** Widest sideways travel, as a fraction of the box's width. */
const MAX_DRIFT = 0.18;
const MAX_TURNS = 2.5;

/**
 * The share of the sequence the last piece may start on.
 *
 * Well short of 1 so every piece still has most of the timeline to fall
 * through — at 1 the stragglers would be cut off in mid-air when the driver
 * lands. The stagger is what stops the burst reading as one falling sheet.
 */
export const CONFETTI_STAGGER = 0.35;

/**
 * Deals a confetti field.
 *
 * Every value is drawn flat rather than shaped the way `buildStarField` cubes
 * its radii: a sky wants a few bright stars among many faint ones, where paper
 * thrown in the air is genuinely uniform, and biasing it only made the burst
 * look sparse.
 */
export const buildConfetti = (
  count: number,
  tints: number,
  seed: number,
): TConfettiPiece[] => {
  const random = mulberry32(seed);

  return Array.from({ length: count }, (_unused, index) => ({
    x: random(),
    drift: (random() * 2 - 1) * MAX_DRIFT,
    size: MIN_SIZE + (MAX_SIZE - MIN_SIZE) * random(),
    ratio: 0.4 + random() * 0.6,
    turns: (random() * 2 - 1) * MAX_TURNS,
    delay: random() * CONFETTI_STAGGER,
    // Dealt round-robin rather than by another draw, so the palette is used
    // evenly however few pieces there are — a random tint per piece can leave a
    // color unused, and with three of them that reads as the wrong palette
    // rather than as chance.
    tint: index % tints,
  }));
};
