import { NativeTabs } from "expo-router/unstable-native-tabs";

import { NewTaskButton } from "@/components/NewTaskButton";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { useTheme } from "@/utils/theme";

/**
 * The native tab bar (iOS/Android). Web declares the same destinations
 * separately, as `WEB_NAV_ITEMS` in `components/WebNav.tsx` — keep the two in
 * sync when a tab is added or removed.
 */
export default function TabsLayout() {
  const theme = useTheme();
  // Week is a large-screen destination (DEX-96): seven columns don't fit a
  // phone, so the tab isn't offered there. Only the *trigger* is conditional
  // — the `week/` route stays registered, and the screen itself explains
  // itself if it is ever reached narrow. Adding or removing a trigger remounts
  // the tab navigator, so this must not be a value that flips often; see
  // `useIsLargeDevice` for why window width is safe to treat as fixed today.
  const largeDevice = useIsLargeDevice();

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={theme.colors.primary}
    >
      <NativeTabs.BottomAccessory>
        <NewTaskButton />
      </NativeTabs.BottomAccessory>
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Icon sf="sun.max" md="light_mode" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {largeDevice && (
        <NativeTabs.Trigger name="week">
          <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
          <NativeTabs.Trigger.Label>Week</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      )}
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
