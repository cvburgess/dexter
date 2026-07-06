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
    </Stack>
  );
}
