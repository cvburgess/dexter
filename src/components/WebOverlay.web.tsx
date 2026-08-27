import type { PointerEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

// Above expo-router's `.modal` (z-index: 50); owned here so every overlay
// stacks the same way instead of each one picking its own number.
const OVERLAY_Z_INDEX = 9999;

const ROOT_STYLE = {
  // Covers the viewport for either fixed or absolute children to position
  // against, since nothing between here and body is transformed.
  position: "fixed",
  inset: 0,
  zIndex: OVERLAY_Z_INDEX,
  // The whole point: Radix sets pointer-events: none on body while open and
  // re-enables auto only on its own layer, so this re-declares it here too.
  pointerEvents: "auto",
} as const;

// Portals into document.body, fixing Radix's inherited pointer-events: none
// while open. In-tree, position:fixed would resolve against .modal's transform.
export function WebOverlay({ children }: { children: ReactNode }) {
  // Radix reads an outside pointerdown as a dismiss, and our portal root is
  // outside its layer, so this stops a click inside from closing it.
  const stopOutsideDismissal = (event: PointerEvent<HTMLDivElement>) =>
    event.stopPropagation();

  const root = (
    <div style={ROOT_STYLE} onPointerDown={stopOutsideDismissal}>
      {children}
    </div>
  );

  // Static export renders via react-dom/server, with no document to portal into.
  return typeof document === "undefined"
    ? root
    : createPortal(root, document.body);
}
