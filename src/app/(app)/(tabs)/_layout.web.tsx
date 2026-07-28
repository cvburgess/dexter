import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";

import { WebNavDock, WebNavRail } from "@/components/WebNav";
import { useShowNavRail } from "@/hooks/useShowNavRail";

/**
 * Web tabs layout. `NativeTabs` (used in `_layout.tsx` for iOS/Android) renders
 * a Radix tab bar on web with no supported way to hide it, so web uses the
 * classic JS `Tabs` navigator with its bar hidden and supplies its own nav
 * chrome instead (DEX-74): `components/WebNav.tsx`'s left rail on wide
 * viewports, its bottom dock on narrow ones — the legacy dexter-app's split.
 * Both are flex siblings of the tab content rather than overlays, so no screen
 * needs to reserve space for them. Headers are owned by each tab's child
 * `Stack`, so they stay off here.
 */
export default function TabsLayout() {
  // The layout owns the decision and the nav components just render, the same
  // split as settings/_layout.tsx. The threshold is the rail's own
  // (`WEB_RAIL_MIN_WIDTH`), not `useIsLargeDevice`'s — see the comment there for
  // why the two differ by the rail's width.
  const rail = useShowNavRail();

  return (
    <View style={[styles.shell, { flexDirection: rail ? "row" : "column" }]}>
      {rail ? <WebNavRail /> : null}
      <View style={styles.content}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        >
          <Tabs.Screen name="today" />
          {/* Registered at every width, unlike its nav item (DEX-96): the
              route has to resolve for a `/week` URL typed or bookmarked on a
              narrow window, where the screen renders an explanation. */}
          <Tabs.Screen name="week" />
          <Tabs.Screen name="settings" />
          <Tabs.Screen name="search" />
        </Tabs>
      </View>
      {rail ? null : <WebNavDock />}
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
