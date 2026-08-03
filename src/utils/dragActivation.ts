/** How far sideways a finger travels before a card is considered picked up. */
const ACTIVATE_X = 15;
/** How far vertically it can travel first before the drag gives up and lets the list scroll. */
const FAIL_Y = 15;

export type TDragActivation = {
  longPressDelay: number;
  dragActivationOffsetX: [number, number];
  dragActivationFailOffsetY: [number, number];
};

/**
 * How a task card's drag activates (DEX-77) — by **direction**, not by time.
 *
 * A card sits under two other gestures: the list it lives in scrolls
 * vertically, and `MoreMenu` opens a native context menu on a long press of the
 * whole card (`IconMenu.native.tsx`). Both of those are what the user wants
 * most of the time, so the drag has to be the reading that only a deliberate
 * sideways pull produces:
 *
 * - **`longPressDelay: 0`** — a stationary press never starts a drag, so the
 *   context menu opens reliably. This is the whole fix. A timed hold cannot
 *   work here: gesture-handler's `activateAfterLongPress` activates the pan
 *   after the delay *regardless of movement*, so any value below the menu's
 *   ~500ms threshold silently cancelled the menu, and any value above it lost
 *   the drag instead. We shipped 100ms and then 200ms before working out that
 *   the whole axis was wrong — the menu only ever appeared when the drag
 *   happened to fail first, which is exactly the intermittency that gave it
 *   away.
 * - **`dragActivationOffsetX`** — the drag activates only once the finger has
 *   travelled sideways. Every meaningful drop is sideways: day → day, backlog →
 *   day, day → backlog, backlog ↔ the Tasks pane. A *vertical* drag has nothing
 *   to mean, because tasks carry no manual order (the canonical list is sorted
 *   by status, priority and due date), so there is no intra-day reordering to
 *   express.
 * - **`dragActivationFailOffsetY`** — vertical travel abandons the drag
 *   outright, handing the gesture back to the day list or the backlog. Without
 *   it a slow scroll that drifted a few pixels sideways would pick a card up.
 *
 * The 15px pair is the usual touch-slop band, and the same shape
 * `SwipeableDay` uses to separate its day-swipe from a vertical scroll
 * (`activeOffsetX` / `failOffsetY`).
 *
 * **One consequence to know:** below ~1150dp the week itself scrolls
 * horizontally, and a sideways gesture starting on a card now goes to the card
 * rather than to that scroller — scroll the week from a day chip or the gutter
 * instead. This is not new behavior so much as newly-consistent: drax already
 * sets `touch-action: pan-y` on drag sources, so touch-web has always worked
 * this way.
 *
 * Web and native share one configuration, which is the other thing this buys.
 * The previous split (0ms on web, a hold on native) carried a trap: with a 0ms
 * delay a `dragActivationFailOffset` is the only rule gesture-handler has left,
 * so setting one on web killed the drag entirely — a footgun that no longer
 * exists now that neither platform uses a hold.
 *
 * `dragActivationOffsetX` and `dragActivationFailOffsetY` are per-axis props
 * added to drax by `patches/react-native-drax+1.1.0.patch`; upstream ships only
 * a single symmetric `dragActivationFailOffset` that applies to both axes at
 * once, which cannot express "activate sideways, fail vertically".
 */
export function dragActivation(): TDragActivation {
  return {
    longPressDelay: 0,
    dragActivationOffsetX: [-ACTIVATE_X, ACTIVATE_X],
    dragActivationFailOffsetY: [-FAIL_Y, FAIL_Y],
  };
}
