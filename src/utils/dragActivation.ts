/** How far sideways a finger travels before a card is considered picked up. */
const ACTIVATE_X = 15;
/** How far vertically it can travel first before the drag gives up and lets the list scroll. */
const FAIL_Y = 15;

export type TDragActivation = {
  longPressDelay: number;
  dragActivationOffsetX: [number, number];
  dragActivationFailOffsetY: [number, number];
};

// Activates by direction, not time (DEX-77) — a timed hold can't coexist
// with the long-press menu. Per-axis offsets come from the drax patch.
export function dragActivation(): TDragActivation {
  return {
    longPressDelay: 0,
    dragActivationOffsetX: [-ACTIVATE_X, ACTIVATE_X],
    dragActivationFailOffsetY: [-FAIL_Y, FAIL_Y],
  };
}
