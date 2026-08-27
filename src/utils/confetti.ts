// The Open tasks all-clear burst (DEX-146) — geometry in fractions, so one
// field fits a phone and a capped-width desktop column alike.

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
 * Deterministic PRNG (mulberry32, same as starField.ts) — Math.random would
 * deal a new field on every re-render, teleporting pieces mid-fall.
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
 * Latest start for the last piece, well short of 1 so stragglers finish
 * falling before the driver lands — otherwise the burst reads as one sheet.
 */
export const CONFETTI_STAGGER = 0.35;

/**
 * Every value drawn flat, unlike buildStarField's cubed radii — paper in
 * the air is genuinely uniform, and biasing it made the burst look sparse.
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
    // Round-robin, not another draw — a random tint can leave a color
    // unused, and with only three that reads as the wrong palette.
    tint: index % tints,
  }));
};
