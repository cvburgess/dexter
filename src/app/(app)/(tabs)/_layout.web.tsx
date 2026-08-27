import { AppShell } from "@/components/AppShell";
import { useShowNavRail } from "@/hooks/useShowNavRail";

// NativeTabs renders an unhideable Radix bar on web (DEX-74), so web uses
// AppShell/AppNav instead; this file only decides rail vs dock (DEX-104).
export default function TabsLayout() {
  const rail = useShowNavRail();

  return <AppShell rail={rail} />;
}
