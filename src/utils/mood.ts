/**
 * The journal's 1-5 mood score (DEX-191): each face's geometry and color as plain
 * data, so a wrong number is a unit-test failure rather than a shape only a
 * device shows.
 */

export const MOOD_RATINGS = [1, 2, 3, 4, 5] as const;

export type TMoodRating = (typeof MOOD_RATINGS)[number];

/** Drawn on a 100x100 viewBox, so every consumer scales by one `size` prop. */
export const MOOD_FACE_VIEWBOX = 100;

export type TMoodFace = {
  /**
   * Deliberately literal, not `theme.colors`: the ramp only means anything as a
   * red-to-green run, which no palette of ours defines.
   */
  color: string;
  /** Mouth path on the shared viewBox. */
  mouth: string;
  /** Filled mouths read as open ones — the grin and the distressed shout. */
  mouthFilled: boolean;
};

export const MOOD_LABELS: Record<TMoodRating, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

/**
 * The five faces, worst to best. Each mouth is spelled out rather than
 * interpolated from a curve: the ends are open shapes and the middle is a
 * straight line, so no single control point produces all five.
 */
export const MOOD_FACES: Record<TMoodRating, TMoodFace> = {
  1: {
    color: "#D6312B",
    mouth: "M 35 69 A 15 15 0 0 1 65 69 Z",
    mouthFilled: true,
  },
  2: {
    color: "#EC8B2E",
    mouth: "M 35 67 Q 50 56 65 67",
    mouthFilled: false,
  },
  3: {
    color: "#F3C32C",
    mouth: "M 36 63 L 64 63",
    mouthFilled: false,
  },
  4: {
    color: "#A2C93C",
    mouth: "M 35 60 Q 50 71 65 60",
    mouthFilled: false,
  },
  5: {
    color: "#34A36B",
    mouth: "M 35 57 A 15 15 0 0 0 65 57 Z",
    mouthFilled: true,
  },
};

/** What a screen reader announces for one face. */
export const moodAccessibilityLabel = (rating: TMoodRating): string =>
  `${MOOD_LABELS[rating]}, ${rating} of 5`;
