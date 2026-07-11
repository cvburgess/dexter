import { Stack } from "expo-router";
import { useWindowDimensions, View } from "react-native";

import { SettingsSidebar } from "@/components/SettingsSidebar";
import { SETTINGS_TWO_PANE_MIN_WIDTH } from "@/utils/settingsItems";
import {
  createListScreenOptions,
  createModalScreenOptions,
} from "@/utils/stackOptions";
import { useTheme } from "@/utils/theme";

export default function SettingsLayout() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const twoPane = width >= SETTINGS_TWO_PANE_MIN_WIDTH;

  const stack = (
    <Stack>
      <Stack.Screen
        name="index"
        options={createListScreenOptions(theme, "Settings")}
      />
      <Stack.Screen
        name="account"
        options={createListScreenOptions(theme, "Account")}
      />
      <Stack.Screen
        name="appearance"
        options={createListScreenOptions(theme, "Appearance")}
      />
      <Stack.Screen
        name="tasks"
        options={createListScreenOptions(theme, "Tasks")}
      />
      <Stack.Screen
        name="calendars"
        options={createListScreenOptions(theme, "Calendars")}
      />
      <Stack.Screen
        name="habits/index"
        options={createListScreenOptions(theme, "Habits")}
      />
      <Stack.Screen
        name="habits/[id]"
        options={createModalScreenOptions(theme, "Habit")}
      />
      <Stack.Screen
        name="journal"
        options={createListScreenOptions(theme, "Journal")}
      />
      <Stack.Screen
        name="notes"
        options={createListScreenOptions(theme, "Notes")}
      />
      <Stack.Screen
        name="licenses"
        options={createListScreenOptions(theme, "Licenses")}
      />
    </Stack>
  );

  // The wrapper structure is identical in both modes — only the sidebar
  // mounts/unmounts — so the Stack keeps its position in the element tree and
  // crossing the breakpoint (resize, rotation) doesn't remount the navigator
  // and drop its history.
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {/* Large screens: persistent sidebar (master list) beside the detail pane. */}
      {twoPane ? <SettingsSidebar /> : null}
      <View style={{ flex: 1 }}>{stack}</View>
    </View>
  );
}
