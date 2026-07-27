import { Stack } from "expo-router";
import { View } from "react-native";

import { SettingsSidebar } from "@/components/SettingsSidebar";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import {
  createListScreenOptions,
  createModalScreenOptions,
} from "@/utils/stackOptions";
import { useTheme } from "@/utils/theme";

/**
 * Anchors the stack so `settings/index` is always mounted underneath, even when
 * a nested screen is entered directly — a hard refresh on a modal's URL, or
 * `MoreMenu` pushing `tasks/[id]` from a task card. Without it that stack holds
 * only the modal, so on web the modal floats over an empty black pane with no
 * sidebar selection, and there is nothing to close back to.
 */
export const unstable_settings = { anchor: "index" };

export default function SettingsLayout() {
  const theme = useTheme();
  const twoPane = useIsMultiPane();

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
        name="tasks/index"
        options={createListScreenOptions(theme, "Tasks")}
      />
      <Stack.Screen
        name="tasks/[id]"
        options={createModalScreenOptions(theme, "Repeat Schedule")}
      />
      <Stack.Screen
        name="lists/index"
        options={createListScreenOptions(theme, "Lists")}
      />
      <Stack.Screen
        name="lists/[id]"
        options={createModalScreenOptions(theme, "List")}
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
