import { dragActivation } from "../dragActivation";

describe("dragActivation", () => {
  // The whole point of the direction-based scheme. `activateAfterLongPress`
  // activates the pan after its delay *regardless of movement*, so any non-zero
  // value cancels the native context menu MoreMenu opens on long-press — which
  // is the only route to schedule presets, priority, duplicate and delete. Two
  // attempts (100ms, then 200ms) failed this way before the axis changed; the
  // menu appeared only when the drag happened to fail first, which is what made
  // it look intermittent rather than broken.
  it("never starts a drag from a stationary press, so the context menu survives", () => {
    expect(dragActivation().longPressDelay).toBe(0);
  });

  it("requires sideways travel before a card is picked up", () => {
    const [min, max] = dragActivation().dragActivationOffsetX;

    expect(max).toBeGreaterThan(0);
    expect(min).toBe(-max);
  });

  // Vertical travel hands the gesture back to the day list or the backlog.
  // Without it a slow scroll that drifted a few pixels sideways would pick a
  // card up instead of scrolling.
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

  // A single configuration for every platform is what retires the old footgun:
  // with a long-press delay of 0, a symmetric `dragActivationFailOffset` was the
  // only rule gesture-handler had left, so setting one killed the drag outright
  // on web. Nothing is platform-conditional now, so that trap can't come back.
  it("takes no platform argument", () => {
    expect(dragActivation).toHaveLength(0);
  });
});
