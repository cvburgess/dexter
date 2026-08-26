import {
  isMoodRating,
  MOOD_RATINGS,
  moodAccessibilityLabel,
  moodMouthCurve,
  moodMouthPath,
} from "../mood";

describe("moodMouthCurve", () => {
  it("is flat at the neutral rating", () => {
    expect(moodMouthCurve(3)).toBe(0);
  });

  it("rises monotonically from frown to smile", () => {
    const curves = MOOD_RATINGS.map(moodMouthCurve);
    expect(curves).toEqual([...curves].sort((a, b) => a - b));
    expect(new Set(curves).size).toBe(MOOD_RATINGS.length);
  });

  it("deflects 1 and 5 equally, in opposite directions", () => {
    expect(moodMouthCurve(1)).toBe(-moodMouthCurve(5));
    expect(moodMouthCurve(2)).toBe(-moodMouthCurve(4));
  });

  it("frowns below neutral and smiles above it", () => {
    // Positive bulges downward — SVG's y axis grows down — so a smile is > 0.
    expect(moodMouthCurve(1)).toBeLessThan(0);
    expect(moodMouthCurve(5)).toBeGreaterThan(0);
  });

  it("clamps out-of-range values rather than drawing off the face", () => {
    expect(moodMouthCurve(0)).toBe(moodMouthCurve(1));
    expect(moodMouthCurve(9)).toBe(moodMouthCurve(5));
  });
});

describe("moodMouthPath", () => {
  it("keeps the corners fixed so only curvature reads as the mood", () => {
    const paths = MOOD_RATINGS.map(moodMouthPath);
    paths.forEach((path) => {
      expect(path.startsWith("M 32 62 Q 50 ")).toBe(true);
      expect(path.endsWith(" 68 62")).toBe(true);
    });
    expect(new Set(paths).size).toBe(MOOD_RATINGS.length);
  });
});

describe("isMoodRating", () => {
  it("accepts the five ratings and nothing else", () => {
    MOOD_RATINGS.forEach((rating) => expect(isMoodRating(rating)).toBe(true));
    [0, 6, 2.5, null, undefined, "3"].forEach((value) =>
      expect(isMoodRating(value)).toBe(false),
    );
  });
});

describe("moodAccessibilityLabel", () => {
  it("announces the word and the position", () => {
    expect(moodAccessibilityLabel(1)).toBe("Rough, 1 of 5");
    expect(moodAccessibilityLabel(5)).toBe("Great, 5 of 5");
  });
});
