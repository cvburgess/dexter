import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";

import { NavDock, NavRail } from "@/components/AppNav";
import { FocusTimerBar } from "@/components/FocusTimerBar";

/**
 * The app's non-native navigation shell: the classic JS `Tabs` navigator with
 * its bar hidden, wrapped in `AppNav`'s own chrome. Rendered on **web** and on
 * **every tablet** (DEX-104) — the two surfaces that can't or shouldn't use
 * `NativeTabs`, for different reasons:
 *
 * - Web can't: `NativeTabs` renders a Radix tab bar there with no supported way
 *   to hide it (DEX-74).
 * - Tablets shouldn't: iPadOS's adaptive sidebar reads worse than the rail, and
 *   moving off `NativeTabs` is what lets the Week destination follow the window
 *   width without remounting the navigator (see `_layout.tsx`).
 *
 * This owns the navigator and the screen registrations, not just the chrome.
 * That's the point of it being shared: the rule that every route is registered
 * regardless of which nav items are visible is one declaration here rather than
 * two copies that drift apart.
 *
 * The rail and the dock are **flex siblings** of the tab content rather than
 * overlays, so no screen has to reserve space for them. Headers are owned by
 * each tab's own child `Stack`, so they stay off here.
 */
export function AppShell({ rail }: { rail: boolean }) {
  return (
    <View style={[styles.shell, { flexDirection: rail ? "row" : "column" }]}>
      {rail ? <NavRail /> : null}
      <View style={styles.content}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        >
          <Tabs.Screen name="today" />
          <Tabs.Screen name="ritual" />
          {/* Registered at every width, unlike its nav item (DEX-96): the
              route has to resolve for a `/week` URL typed or bookmarked on a
              narrow window, or deep-linked on a tablet, where the screen
              renders an explanation instead of the grid. */}
          <Tabs.Screen name="week" />
          <Tabs.Screen name="settings" />
          <Tabs.Screen name="search" />
        </Tabs>
        {/* A flex sibling of the tab content for the same reason the rail and
            dock are: no screen has to reserve space for it, and it can't cover
            the last card in a list. Renders `null` unless a block is running,
            and on narrow web it lands directly above the dock (DEX-49). */}
        <FocusTimerBar />
      </View>
      {rail ? null : <NavDock />}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
