/**
 * The journal's 1-5 mood score (DEX-191): the face geometry as plain numbers, so
 * a wrong curve is a unit-test failure rather than a shape only a device shows.
 */

export const MOOD_RATINGS = [1, 2, 3, 4, 5] as const;

export type TMoodRating = (typeof MOOD_RATINGS)[number];

/** Drawn on a 100x100 viewBox, so every consumer scales by one `size` prop. */
export const MOOD_FACE_VIEWBOX = 100;

const MOUTH_LEFT = 32;
const MOUTH_RIGHT = 68;
const MOUTH_MID = 50;
const MOUTH_Y = 62;
// Deflects the mouth's midpoint by half this, so 5 lifts as far as 1 drops.
const MOUTH_TRAVEL = 24;

const NEUTRAL: TMoodRating = 3;

export const MOOD_LABELS: Record<TMoodRating, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

export const isMoodRating = (value: unknown): value is TMoodRating =>
  MOOD_RATINGS.includes(value as TMoodRating);

/**
 * The mouth's control-point offset in viewBox units. Positive bulges downward —
 * a smile — because SVG's y axis grows down.
 */
export const moodMouthCurve = (rating: number): number => {
  const clamped = Math.min(5, Math.max(1, rating));
  return ((clamped - NEUTRAL) / 2) * MOUTH_TRAVEL;
};

/** A quadratic arc with fixed corners, so only the curvature reads as the mood. */
export const moodMouthPath = (rating: number): string =>
  `M ${MOUTH_LEFT} ${MOUTH_Y} Q ${MOUTH_MID} ${MOUTH_Y + moodMouthCurve(rating)} ${MOUTH_RIGHT} ${MOUTH_Y}`;

/** What a screen reader announces for one face. */
export const moodAccessibilityLabel = (rating: TMoodRating): string =>
  `${MOOD_LABELS[rating]}, ${rating} of 5`;
