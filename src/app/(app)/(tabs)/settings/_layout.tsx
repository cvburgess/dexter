import { WebModalStack } from "@/components/WebModalStack";
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
    <WebModalStack>
      <WebModalStack.Screen name="index" options={listOptions("Settings")} />
      <WebModalStack.Screen name="account" options={listOptions("Account")} />
      <WebModalStack.Screen
        name="appearance"
        options={listOptions("Appearance")}
      />
      {/* Header stays here, not in tasks/_layout.tsx's nested stack: a stack's
          root screen gets no native back button (DEX-93). */}
      <WebModalStack.Screen name="tasks" options={listOptions("Tasks")} />
      <WebModalStack.Screen name="lists/index" options={listOptions("Lists")} />
      <WebModalStack.Screen
        name="lists/[id]"
        options={createModalScreenOptions(theme, "List")}
      />
      <WebModalStack.Screen
        name="calendars"
        options={listOptions("Calendars")}
      />
      <WebModalStack.Screen
        name="habits/index"
        options={listOptions("Habits")}
      />
      <WebModalStack.Screen
        name="habits/[id]"
        options={createModalScreenOptions(theme, "Habit")}
      />
      <WebModalStack.Screen name="ritual" options={listOptions("Ritual")} />
      <WebModalStack.Screen name="notes" options={listOptions("Notes")} />
      <WebModalStack.Screen name="licenses" options={listOptions("Licenses")} />
    </WebModalStack>
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
