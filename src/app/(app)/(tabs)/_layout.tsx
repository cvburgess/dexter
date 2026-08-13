import { NativeTabs } from "expo-router/unstable-native-tabs";

import { AppShell } from "@/components/AppShell";
import { TabBarAccessory } from "@/components/TabBarAccessory";
import { IS_TABLET } from "@/utils/deviceType";
import { useTheme } from "@/utils/theme";

/**
 * The native tabs layout — which, since DEX-104, means the **phone** tab bar.
 * Tablets take the same rail + JS `Tabs` shell as web
 * (`components/AppShell.tsx`), because iPadOS's adaptive sidebar reads worse
 * than the rail on a large screen.
 *
 * Phones declare their destinations here; every other surface declares them as
 * `NAV_ITEMS` in `components/AppNav.tsx`. Keep the two in sync when a tab is
 * added or removed — but note they are no longer the same list, and shouldn't
 * be: Week is a large-screen destination with no place on a phone at all.
 */
export default function TabsLayout() {
  const theme = useTheme();

  // A constant, not a hook, so this branch is fixed for the process lifetime —
  // the navigator is chosen once and never swapped under a running app. That is
  // also what lets the `week` trigger below simply not exist rather than be
  // gated on width: a phone is never a tablet, so no window-dependent value
  // decides the trigger set any more. `NativeTabs` is built on expo-router's
  // `useOnlyUserDefinedScreens`, so changing that set unregisters routes and
  // remounts the navigator, resetting every tab's state.
  if (IS_TABLET) return <AppShell rail />;

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={theme.colors.primary}
    >
      {/* One accessory element, two jobs: the running focus block when there is
          one, "＋ New Task" otherwise (DEX-49). The slot takes a single element,
          so the branch lives inside it. */}
      <NativeTabs.BottomAccessory>
        <TabBarAccessory />
      </NativeTabs.BottomAccessory>
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Icon sf="sun.max" md="light_mode" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* Unlike Week, Ritual *is* a phone destination: one route serves every
          width, with the layout rather than the destination changing (DEX-127).
          One fixed glyph for both halves of the day too — the moon stands for
          the ritual as a whole, and a tab whose icon changed at noon would read
          as a different destination. */}
      <NativeTabs.Trigger name="ritual">
        <NativeTabs.Trigger.Icon sf="moon.stars" md="bedtime" />
        <NativeTabs.Trigger.Label>Ritual</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* No `week` trigger: seven columns don't fit a phone (DEX-96), and a
          phone is the only thing that reaches this branch. Its route is
          therefore never registered here, so `/week` doesn't resolve on a
          phone — nothing links to it there. */}
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gear" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
