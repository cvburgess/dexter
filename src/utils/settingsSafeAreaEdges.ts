// Module-scope for a stable reference. No `bottom`: these screens scroll
// under the tab bar and reserve insets.bottom in content instead (DEX-91).
export const EDGES_SINGLE_PANE = ["left", "right"] as const;
export const EDGES_TWO_PANE = ["right"] as const;
