import type { PointerEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

// Above expo-router's modal chrome, whose `.modal` class takes `z-index: 50`
// (`expo-router/assets/modal.module.css`) and whose vaul overlay and drawer
// content are both `z-index: auto`. Owned here so every overlay stacks the
// same way instead of each one picking its own number.
const OVERLAY_Z_INDEX = 9999;

const ROOT_STYLE = {
  // Covers the viewport so children can position against it with either
  // `fixed` or `absolute` — nothing between here and the body is transformed,
  // so both resolve to the same viewport coordinates a `getBoundingClientRect()`
  // anchor was measured in.
  position: "fixed",
  inset: 0,
  zIndex: OVERLAY_Z_INDEX,
  // The entire point of this component. `pointer-events` is inherited, and a
  // Radix dismissable layer sets `pointer-events: none` on `document.body`
  // while it is open, so re-declaring `auto` here is what keeps the overlay
  // hit-testable — the same move Radix makes for its own layers and expo-router
  // makes for its `.modal` div.
  pointerEvents: "auto",
} as const;

/**
 * The one way a web overlay reaches the screen. Portals its children into
 * `document.body` and makes that portal root explicitly interactive.
 *
 * **Why this exists.** Expo Router's web modal stack renders every modal screen
 * through `vaul` (`ModalStackRouteDrawer`), which is a Radix dialog, and
 * `TaskDrawerSheet` renders a vaul drawer on small screens. While either is
 * open, `@radix-ui/react-dismissable-layer` sets `pointer-events: none` on
 * `document.body` and re-enables `auto` on its own layer only. `pointer-events`
 * is inherited, so anything rendered outside that layer — a `document.body`
 * portal, or a subtree of the page underneath a drawer — paints on top but
 * swallows every click: visible, unreachable, no error, no fallback. The defect
 * is inherited `pointer-events`, not `inert` or `aria-hidden`, which is why an
 * explicit `pointerEvents: "auto"` on the overlay's own root is the whole fix.
 *
 * **Why portal rather than render in-tree.** An in-tree overlay inside a modal
 * screen is inside the interactive layer and does work — but `position: fixed`
 * then resolves against `.modal`'s `will-change: transform` containing block
 * instead of the viewport, so a popover anchored to a `getBoundingClientRect()`
 * reading lands at the wrong place, and a backdrop covers the modal rather than
 * the page. Portalling to the body keeps viewport coordinates honest; the
 * `pointerEvents` declaration is what buys back the interactivity.
 *
 * **The root covers the viewport and takes pointer events**, so whatever is
 * behind it is unclickable for as long as the overlay is mounted. Render this
 * only while the overlay is open, and give it a child that dismisses on an
 * outside click (a full-bleed catcher or a backdrop) — otherwise the page is
 * simply dead until something else closes it.
 *
 * Web-only by construction: iOS and Android use real native presentations and
 * never see any of this.
 */
export function WebOverlay({ children }: { children: ReactNode }) {
  // Radix's dismissable layer listens for `pointerdown` on the *document*, in
  // the bubble phase, and reads any event whose target is outside its own layer
  // as an outside click — which dismisses the dialog or drawer. Our portal root
  // is a body child, so it is outside by construction. Today those events never
  // arrive (the body is `none`), so the moment this component re-enables them, a
  // click inside the overlay would close the modal behind it. Stopping the
  // event here, at the outermost node of the portal, is what prevents that.
  //
  // React delegates a body portal's own listeners to `document.body`, one node
  // below `document`, so every handler inside the overlay has already run by the
  // time this fires.
  //
  // **`pointerdown` only — never `mousedown` or `touchstart`.** Radix tracks
  // those two as well, but only to annotate an outside interaction it has
  // already detected from a `pointerdown`, so stopping them buys nothing. It
  // costs plenty: react-native-web's responder system, which every `Pressable`
  // and `TouchableOpacity` is built on, binds `mousedown`/`touchstart` on the
  // *document* in the bubble phase too (`ResponderSystem.js`, `attachListeners`),
  // so stopping either here makes every RN pressable inside an overlay dead to
  // the touch — the exact symptom this component exists to fix, arriving by a
  // different route. `pointerdown` is safe because nothing in react-native-web
  // listens for it outside the capture phase.
  const stopOutsideDismissal = (event: PointerEvent<HTMLDivElement>) =>
    event.stopPropagation();

  const root = (
    <div style={ROOT_STYLE} onPointerDown={stopOutsideDismissal}>
      {children}
    </div>
  );

  // Static web export renders through `react-dom/server`, where there is no
  // document to portal into.
  return typeof document === "undefined"
    ? root
    : createPortal(root, document.body);
}
