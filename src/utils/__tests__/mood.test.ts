import {
  isMoodRating,
  MOOD_FACES,
  MOOD_LABELS,
  MOOD_RATINGS,
  moodAccessibilityLabel,
} from "../mood";

describe("MOOD_FACES", () => {
  it("defines a face and a label for every rating", () => {
    MOOD_RATINGS.forEach((rating) => {
      expect(MOOD_FACES[rating]).toBeDefined();
      expect(MOOD_LABELS[rating]).toBeTruthy();
    });
  });

  it("gives each rating its own color and its own mouth", () => {
    const colors = MOOD_RATINGS.map((rating) => MOOD_FACES[rating].color);
    const mouths = MOOD_RATINGS.map((rating) => MOOD_FACES[rating].mouth);

    expect(new Set(colors).size).toBe(MOOD_RATINGS.length);
    expect(new Set(mouths).size).toBe(MOOD_RATINGS.length);
  });

  it("crosses out the eyes on the worst rating alone", () => {
    expect(MOOD_FACES[1].eyes).toBe("cross");
    [2, 3, 4, 5].forEach((rating) =>
      expect(MOOD_FACES[rating as 2].eyes).toBe("dots"),
    );
  });

  // Filled mouths are the open ones at either end; the middle three are
  // stroked curves, and filling one of those would blot out the whole face.
  it("fills only the two open mouths", () => {
    expect(MOOD_FACES[1].mouthFilled).toBe(true);
    expect(MOOD_FACES[5].mouthFilled).toBe(true);
    [2, 3, 4].forEach((rating) =>
      expect(MOOD_FACES[rating as 2].mouthFilled).toBe(false),
    );
  });

  it("closes every filled mouth so it renders as a shape, not a hairline", () => {
    MOOD_RATINGS.filter((rating) => MOOD_FACES[rating].mouthFilled).forEach(
      (rating) => expect(MOOD_FACES[rating].mouth.trimEnd()).toMatch(/Z$/),
    );
  });

  it("keeps every mouth inside the viewBox", () => {
    MOOD_RATINGS.forEach((rating) => {
      const coords = MOOD_FACES[rating].mouth.match(/\d+(\.\d+)?/g) ?? [];
      coords.forEach((coord) => {
        expect(Number(coord)).toBeGreaterThanOrEqual(0);
        expect(Number(coord)).toBeLessThanOrEqual(100);
      });
    });
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
