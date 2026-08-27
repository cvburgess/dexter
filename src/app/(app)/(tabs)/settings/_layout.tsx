import { Stack } from "expo-router";
import { View } from "react-native";

import { SettingsSidebar } from "@/components/SettingsSidebar";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import {
  createListScreenOptions,
  createModalScreenOptions,
} from "@/utils/stackOptions";
import { useTheme } from "@/utils/theme";

// Anchors the stack so settings/index is always mounted underneath a nested
// screen entered directly — otherwise the modal floats with nothing to close to.
export const unstable_settings = { anchor: "index" };

export default function SettingsLayout() {
  const theme = useTheme();
  const twoPane = useIsLargeDevice();

  // Hides the back item on a large screen: it leads to settings/index, but
  // the sidebar already is that list and never leaves (DEX-61).
  const listOptions = (title: string) => ({
    ...createListScreenOptions(theme, title),
    headerBackVisible: !twoPane,
  });

  const stack = (
    <Stack>
      <Stack.Screen name="index" options={listOptions("Settings")} />
      <Stack.Screen name="account" options={listOptions("Account")} />
      <Stack.Screen name="appearance" options={listOptions("Appearance")} />
      {/* Header stays here rather than moving into tasks/_layout.tsx's nested
          stack: a stack's root screen gets no native back button, so the
          parent has to own the header to give Tasks one (DEX-93). */}
      <Stack.Screen name="tasks" options={listOptions("Tasks")} />
      <Stack.Screen name="lists/index" options={listOptions("Lists")} />
      <Stack.Screen
        name="lists/[id]"
        options={createModalScreenOptions(theme, "List")}
      />
      <Stack.Screen name="calendars" options={listOptions("Calendars")} />
      <Stack.Screen name="habits/index" options={listOptions("Habits")} />
      <Stack.Screen
        name="habits/[id]"
        options={createModalScreenOptions(theme, "Habit")}
      />
      <Stack.Screen name="ritual" options={listOptions("Ritual")} />
      <Stack.Screen name="notes" options={listOptions("Notes")} />
      <Stack.Screen name="licenses" options={listOptions("Licenses")} />
    </Stack>
  );

  // Wrapper structure is identical in both modes (only the sidebar toggles)
  // so crossing the breakpoint doesn't remount the navigator and drop history.
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {/* Large screens: persistent sidebar (master list) beside the detail pane. */}
      {twoPane ? <SettingsSidebar /> : null}
      <View style={{ flex: 1 }}>{stack}</View>
    </View>
  );
}
