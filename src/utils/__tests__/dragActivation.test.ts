import { dragActivation } from "../dragActivation";

describe("dragActivation", () => {
  // Any non-zero `activateAfterLongPress` fires regardless of movement and kills
  // MoreMenu's long-press context menu — 100ms and 200ms both failed that way.
  it("never starts a drag from a stationary press, so the context menu survives", () => {
    expect(dragActivation().longPressDelay).toBe(0);
  });

  it("requires sideways travel before a card is picked up", () => {
    const [min, max] = dragActivation().dragActivationOffsetX;

    expect(max).toBeGreaterThan(0);
    expect(min).toBe(-max);
  });

  // Without the vertical fail offset, a slow scroll drifting a few pixels
  // sideways would pick a card up instead of scrolling.
  it("abandons the drag on vertical travel, leaving the list to scroll", () => {
    const [min, max] = dragActivation().dragActivationFailOffsetY;

    expect(max).toBeGreaterThan(0);
    expect(min).toBe(-max);
  });

  // Both thresholds live in the usual touch-slop band. Too small and an
  // imprecise tap starts a drag; too large and the drag feels unresponsive.
  it("keeps both thresholds inside the touch-slop band", () => {
    const { dragActivationOffsetX, dragActivationFailOffsetY } =
      dragActivation();

    for (const [, threshold] of [
      dragActivationOffsetX,
      dragActivationFailOffsetY,
    ]) {
      expect(threshold).toBeGreaterThanOrEqual(8);
      expect(threshold).toBeLessThanOrEqual(30);
    }
  });

  // One config for every platform: a symmetric `dragActivationFailOffset` once
  // killed the drag outright on web, and platform branches would let that return.
  it("takes no platform argument", () => {
    expect(dragActivation).toHaveLength(0);
  });
});
