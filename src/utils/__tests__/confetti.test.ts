import {
  buildConfetti,
  CONFETTI_STAGGER,
  TConfettiPiece,
} from "@/utils/confetti";

// DEX-146. Nothing here asserts how the burst *looks* — that is taste, tuned by
// eye. These pin the properties the animation depends on.

describe("buildConfetti", () => {
  // The step can re-render while the field animates (another device's task
  // arriving), so Math.random would teleport pieces mid-fall.
  it("deals the same field for the same seed", () => {
    expect(buildConfetti(28, 5, 146)).toEqual(buildConfetti(28, 5, 146));
  });

  it("gives a different seed a different field", () => {
    expect(buildConfetti(20, 5, 1)).not.toEqual(buildConfetti(20, 5, 2));
  });

  // `x`/`delay` are fractions of the box/driver — out of range falls off-
  // screen or never starts; past CONFETTI_STAGGER a piece is cut mid-air.
  it("keeps every piece inside the box and inside the sequence", () => {
    const pieces = buildConfetti(60, 5, 7);

    expect(pieces).toHaveLength(60);
    for (const piece of pieces) {
      expect(piece.x).toBeGreaterThanOrEqual(0);
      expect(piece.x).toBeLessThanOrEqual(1);
      expect(piece.delay).toBeGreaterThanOrEqual(0);
      expect(piece.delay).toBeLessThanOrEqual(CONFETTI_STAGGER);
      expect(piece.size).toBeGreaterThan(0);
      expect(piece.ratio).toBeGreaterThan(0);
    }
  });

  // Round-robin, not another draw — with few pieces a random tint can leave
  // a color unused, reading as the wrong palette.
  it("uses every tint evenly", () => {
    const counts = new Map<number, number>();
    for (const piece of buildConfetti(30, 5, 3)) {
      counts.set(piece.tint, (counts.get(piece.tint) ?? 0) + 1);
      expect(piece.tint).toBeLessThan(5);
    }

    expect(counts.size).toBe(5);
    const sizes = [...counts.values()];
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  // Both are signed, so the field drifts and spins in both directions. Drawn
  // one-sided it reads as a gust rather than as a burst.
  it("throws paper both ways", () => {
    const pieces: TConfettiPiece[] = buildConfetti(40, 5, 11);

    expect(pieces.some((piece) => piece.drift < 0)).toBe(true);
    expect(pieces.some((piece) => piece.drift > 0)).toBe(true);
    expect(pieces.some((piece) => piece.turns < 0)).toBe(true);
    expect(pieces.some((piece) => piece.turns > 0)).toBe(true);
  });
});
