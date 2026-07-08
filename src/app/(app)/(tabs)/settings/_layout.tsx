import { Stack } from "expo-router";

import { createListScreenOptions } from "@/utils/stackOptions";
import { useTheme } from "@/utils/theme";

export default function SettingsLayout() {
  const theme = useTheme();

  return (
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
}
