import { dragActivation } from "../dragActivation";

describe("dragActivation", () => {
  it("activates immediately on web, where a delay loses the drag to touch-slop cancellation", () => {
    expect(dragActivation("web").longPressDelay).toBe(0);
  });

  it("holds briefly on native, so a flick scrolls the list instead of picking a card up", () => {
    expect(dragActivation("ios").longPressDelay).toBeGreaterThan(0);
    expect(dragActivation("android").longPressDelay).toBeGreaterThan(0);
  });

  // Bounded on both sides, and both bounds are real behavior rather than taste.
  // Under ~150ms the hold falls inside an ordinary lingering tap, so resting a
  // finger on a card lifts it instead of pressing what's under it. At or above
  // ~500ms it collides with the SwiftUI context menu MoreMenu opens on
  // long-press — and that menu is the only route to schedule presets, priority,
  // duplicate and delete. Asserted as a range rather than pinned to the current
  // value, so tuning stays free but can't cross either line.
  it("holds long enough to outlast a tap and briefly enough to clear the context menu", () => {
    const { longPressDelay } = dragActivation("ios");

    expect(longPressDelay).toBeGreaterThanOrEqual(150);
    expect(longPressDelay).toBeLessThan(500);
  });

  // The coupling this function exists to hold. React Native Gesture Handler
  // evaluates shouldFail() before shouldActivate(), and only consults its
  // long-press branch when activateAfterLongPress > 0 — so with a 0ms delay the
  // fail offset becomes the only rule left, the pan fails at that many pixels of
  // travel, and the drag can never start. A future tidy-up that gives web a fail
  // offset "for consistency" would silently break dragging on the app's primary
  // large-screen target; this is what catches it.
  it.each(["web", "ios", "android"] as const)(
    "sets a fail offset only when there is a long-press window to cancel (%s)",
    (platform) => {
      const { longPressDelay, dragActivationFailOffset } =
        dragActivation(platform);

      expect(dragActivationFailOffset !== undefined).toBe(longPressDelay > 0);
    },
  );

  it("defaults to the running platform when none is given", () => {
    // Jest's preset reports "ios"; the point is only that the argument is
    // optional and resolves to something valid, not which platform that is.
    expect(dragActivation()).toEqual(dragActivation("ios"));
  });
});
