import { Tabs } from "expo-router";

/**
 * Web tabs layout. `NativeTabs` (used in `_layout.tsx` for iOS/Android) renders
 * a Radix tab bar on web with no supported way to hide it, and web navigates by
 * URL rather than a bottom bar. So web uses the classic JS `Tabs` navigator with
 * its bar hidden — the same three routes (each with its own stack) stay
 * reachable via the router, just without an on-screen tab bar. Headers are owned
 * by each tab's child `Stack`, so they stay off here.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="search" />
    </Tabs>
  );
}
