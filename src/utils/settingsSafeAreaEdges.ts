// Shared by settings screens that render in the two-pane detail slot beside
// SettingsSidebar (see account.tsx): the sidebar absorbs the left inset in
// two-pane mode. Hoisted to module scope so SafeAreaView's internal `edges`
// useMemo sees a stable reference instead of a new array every render.
export const EDGES_SINGLE_PANE = ["bottom", "left", "right"] as const;
export const EDGES_TWO_PANE = ["bottom", "right"] as const;
