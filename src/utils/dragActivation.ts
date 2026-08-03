import { Platform } from "react-native";

export type TDragActivation = {
  longPressDelay: number;
  dragActivationFailOffset?: number;
};

/**
 * How a task card's drag activates, per platform (DEX-77). A pure exported
 * function rather than two inline literals because the two values are coupled
 * in a way that isn't locally obvious — see below — so the coupling gets a unit
 * test instead of a comment nobody reads. Same shape as `SwipeableDay`'s
 * exported `getSwipeCommitDirection`.
 *
 * `longPressDelay`: on native a press must be held before the drag takes over,
 * so a quick flick still scrolls the list under it. Web activates immediately —
 * there's no competing menu there (`IconMenu.web.tsx` binds only
 * `onContextMenu`) and a non-zero delay loses the drag to the browser's
 * touch-slop cancellation.
 *
 * 200ms on native is bounded on both sides. Below it, the hold falls inside an
 * ordinary lingering tap: at 100ms, resting a finger on a card for a beat
 * before releasing lifted it instead of registering the press, which is a
 * particular problem for the `StatusButton` and subtask rows the card carries.
 * Above ~500ms it would collide with the SwiftUI context menu that
 * `MoreMenu` opens on long-press (`IconMenu.native.tsx`) — and that menu is the
 * *only* way to reach schedule presets, priority, duplicate and delete, so
 * losing it would cost far more than the drag is worth. Verified by hand on
 * iPad: both gestures coexist at this value.
 *
 * The hold exists only because native has no equivalent of the
 * `touch-action: pan-y` drax sets on web, which lets the browser keep vertical
 * scrolling without gesture-handler arbitrating at all. On native the two
 * gestures share one recognizer, so scroll and drag have to be told apart by
 * time (this) or by region (a drag handle, which would put a grip on every card
 * in a 160dp-wide week column).
 *
 * `dragActivationFailOffset`: cancels activation if the pointer travels this
 * far *while the long press is still pending*, so a scroll that happens to
 * start on a card scrolls the list instead of picking the card up — the same
 * disambiguation `SwipeableDay` gets from `failOffsetY`.
 *
 * It is coupled to the delay in two ways. Softly: the shorter the window, the
 * less distance a scroll covers inside it, so the less likely this is to catch
 * one. At 200ms a fast flick clears 12px easily, and a slow deliberate scroll
 * now has twice as long to do the same — lower this before raising the delay
 * if slow scrolls ever start grabbing cards.
 *
 * And hard: the offset **must** be left unset when there is no long-press
 * window. gesture-handler's pan handler evaluates `shouldFail()` before
 * `shouldActivate()`, and only consults its long-press branch when
 * `activateAfterLongPress > 0` — so with a 0ms delay the fail offset is the
 * only rule left, the gesture fails at 12px of travel, and the drag can never
 * start at all. Web doesn't need it anyway: drax sets `touch-action: pan-y`
 * there, and that is what keeps the list scrollable.
 */
export function dragActivation(
  platform: typeof Platform.OS = Platform.OS,
): TDragActivation {
  const longPressDelay = platform === "web" ? 0 : 200;
  return {
    longPressDelay,
    dragActivationFailOffset: longPressDelay > 0 ? 12 : undefined,
  };
}
