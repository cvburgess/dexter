import { NativeTabs } from "expo-router/unstable-native-tabs";

import { AppShell } from "@/components/AppShell";
import { TabBarAccessory } from "@/components/TabBarAccessory";
import { IS_TABLET } from "@/utils/deviceType";
import { useTheme } from "@/utils/theme";

// The phone tab bar (DEX-104) — tablets take the rail + JS Tabs shell.
// Phones declare destinations here; keep AppNav.tsx's NAV_ITEMS in sync.
export default function TabsLayout() {
  const theme = useTheme();

  // A constant, not a hook: NativeTabs remounts and resets tab state on any
  // trigger-set change, so the navigator must be chosen once.
  if (IS_TABLET) return <AppShell rail />;

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={theme.colors.primary}
    >
      {/* One accessory: the running focus block, or "＋ New Task" (DEX-49) —
          the slot takes one element, so the branch lives inside it. */}
      <NativeTabs.BottomAccessory>
        <TabBarAccessory />
      </NativeTabs.BottomAccessory>
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Icon sf="sun.max" md="light_mode" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* Unlike Week, Ritual is a phone destination (DEX-127): one fixed
          glyph too — an icon that changed at noon would read as a new tab. */}
      <NativeTabs.Trigger name="ritual">
        <NativeTabs.Trigger.Icon sf="moon.stars" md="bedtime" />
        <NativeTabs.Trigger.Label>Ritual</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* No `week` trigger: seven columns don't fit a phone (DEX-96), so the
          route is never registered here and /week doesn't resolve. */}
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gear" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
