// Shared by settings screens that render in the two-pane detail slot beside
// SettingsSidebar: the sidebar absorbs the left inset in two-pane mode.
// Hoisted to module scope so SafeAreaView's internal `edges` useMemo sees a
// stable reference instead of a new array every render.
//
// Deliberately no `bottom`: like the Today tab, these screens let their list
// scroll *under* the translucent tab bar and reserve `insets.bottom` in the
// scroll content instead (DEX-91). Claiming the edge here would stop the list
// dead at the bar, which reads as a cut-off rather than a native scroll.
// `account.tsx` is the one screen that still claims it — it has no scroll
// container, so there is nothing to scroll clear of the bar and its buttons
// would simply sit under it.
export const EDGES_SINGLE_PANE = ["left", "right"] as const;
export const EDGES_TWO_PANE = ["right"] as const;
