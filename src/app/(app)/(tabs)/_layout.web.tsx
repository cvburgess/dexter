import { AppShell } from "@/components/AppShell";
import { useShowNavRail } from "@/hooks/useShowNavRail";

/**
 * Web tabs layout. `NativeTabs` (used in `_layout.tsx` for phones) renders a
 * Radix tab bar on web with no supported way to hide it, so web uses the shared
 * `components/AppShell.tsx` — the classic JS `Tabs` navigator with its bar
 * hidden, plus `components/AppNav.tsx`'s own chrome (DEX-74).
 *
 * All this file decides is rail vs dock, the one thing that differs from the
 * tablet path: web swaps to the bottom dock below `RAIL_MIN_WIDTH`, where a
 * 76dp rail costs too much of a narrow browser window, while a tablet keeps the
 * rail at every width (DEX-104). The threshold is the rail's own, not
 * `useIsLargeDevice`'s — see `RAIL_MIN_WIDTH` for why the two differ by the
 * rail's width. The layout owns the decision and the nav components just
 * render, the same split as `settings/_layout.tsx`.
 */
export default function TabsLayout() {
  const rail = useShowNavRail();

  return <AppShell rail={rail} />;
}
