import { Stack } from "expo-router";
import { View } from "react-native";

import { SettingsSidebar } from "@/components/SettingsSidebar";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
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
  const twoPane = useIsLargeDevice();

  /**
   * A detail screen's header options, minus its back item on a large screen.
   *
   * That back item leads to `settings/index` — the list of sections — because
   * `unstable_settings.anchor` keeps index mounted beneath every detail screen.
   * In two-pane mode the sidebar *is* that list and never leaves, so the
   * chevron offers a trip to something already on screen, and on the section a
   * user is already looking at (DEX-61).
   *
   * Titles stay in both modes. This includes `tasks`, whose back button is the
   * whole point of the parent owning its header (DEX-93) — that reasoning is
   * about the single-column case, where the list would otherwise be stranded
   * with no way out. On a large screen the sidebar is the way out.
   */
  const listOptions = (title: string) => ({
    ...createListScreenOptions(theme, title),
    headerBackVisible: !twoPane,
  });

  const stack = (
    <Stack>
      <Stack.Screen name="index" options={listOptions("Settings")} />
      <Stack.Screen name="account" options={listOptions("Account")} />
      <Stack.Screen name="appearance" options={listOptions("Appearance")} />
      {/* Its own nested stack, so the editor always has the list beneath it —
          see `tasks/_layout.tsx`. The list's header stays *here* rather than
          moving down with it: `tasks/index` is the root of that nested stack,
          and a stack's root screen gets no native back button and no
          swipe-back, however much history sits under the navigator itself. The
          back item is drawn by the platform from its own controller's stack,
          not from React Navigation's parent-aware `canGoBack`, so the only way
          to give the Tasks list a back button is for the parent to own the
          header (DEX-93). */}
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
      <Stack.Screen name="journal" options={listOptions("Journal")} />
      <Stack.Screen name="notes" options={listOptions("Notes")} />
      <Stack.Screen name="licenses" options={listOptions("Licenses")} />
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
