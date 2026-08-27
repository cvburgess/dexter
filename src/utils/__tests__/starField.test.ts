import { buildStarField, TStar } from "@/utils/starField";

// DEX-128. Nothing here asserts how the sky *twinkles* — that is taste, tuned
// by eye. These pin the properties the layout depends on.

const flat = (field: TStar[][]) => field.flat();

describe("buildStarField", () => {
  it("deals every star out across the layers", () => {
    const field = buildStarField(72, 4, 128);

    expect(field).toHaveLength(4);
    expect(flat(field)).toHaveLength(72);
  });

  // Every layer costs one animation regardless of contents — round-robin
  // dealing guarantees none run empty.
  it("fills the layers evenly, leaving none empty", () => {
    const field = buildStarField(30, 4, 1);
    const sizes = field.map((layer) => layer.length);

    expect(Math.min(...sizes)).toBeGreaterThan(0);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  // The sky must be the same one on every launch and every device. `x`/`y` are
  // percentages, so a star outside 0–100 would simply never be drawn.
  it("is deterministic and stays inside the panel", () => {
    const field = buildStarField(50, 3, 7);

    expect(field).toEqual(buildStarField(50, 3, 7));

    for (const star of flat(field)) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(100);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(100);
      expect(star.radius).toBeGreaterThan(0);
      expect(star.opacity).toBeGreaterThan(0);
      expect(star.opacity).toBeLessThanOrEqual(1);
    }
  });

  it("gives a different seed a different sky", () => {
    expect(buildStarField(20, 2, 1)).not.toEqual(buildStarField(20, 2, 2));
  });

  // Cubed, not flat, so most stars are small/faint with a few bright — a
  // uniform field reads as noise rather than a sky.
  it("keeps most stars small, with a few standing out", () => {
    const stars = flat(buildStarField(200, 4, 42));
    const radii = stars.map((star) => star.radius).sort((a, b) => a - b);
    const median = radii[Math.floor(radii.length / 2)];

    expect(median).toBeLessThan((radii[0] + radii[radii.length - 1]) / 2);
  });
});
