import { Stack } from "expo-router";
import { useWindowDimensions, View } from "react-native";

import { SettingsSidebar } from "@/components/SettingsSidebar";
import { SETTINGS_TWO_PANE_MIN_WIDTH } from "@/utils/settingsItems";
import { createListScreenOptions } from "@/utils/stackOptions";
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
        name="habits"
        options={createListScreenOptions(theme, "Habits")}
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

  if (!twoPane) return stack;

  // Large screens: persistent sidebar (master list) beside the detail pane.
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <SettingsSidebar />
      <View style={{ flex: 1 }}>{stack}</View>
    </View>
  );
}
