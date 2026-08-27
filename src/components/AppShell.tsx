import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";

import { NavDock, NavRail } from "@/components/AppNav";
import { FocusTimerBar } from "@/components/FocusTimerBar";
import { useTheme } from "@/utils/theme";

// Web + tablet shell (DEX-74, DEX-104): JS Tabs with the bar hidden, owning
// all registrations in one place; rail/dock are flex siblings, not overlays.
export function AppShell({ rail }: { rail: boolean }) {
  const theme = useTheme();

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
          {/* Registered at every width, unlike its nav item (DEX-96): a
              typed or bookmarked `/week` URL has to resolve. */}
          <Tabs.Screen name="week" />
          <Tabs.Screen name="settings" />
          <Tabs.Screen name="search" />
        </Tabs>
        {/* Floats over content (DEX-49) — a flex sibling would move the
            bottom edge on every block start; box-none keeps touches passing through. */}
        <View
          pointerEvents="box-none"
          style={[styles.timer, { padding: theme.space.md }]}
        >
          <FocusTimerBar />
        </View>
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
  timer: {
    alignItems: "center",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
});
