import { NativeTabs } from "expo-router/unstable-native-tabs";

import { NewTaskButton } from "@/components/NewTaskButton";
import { useTheme } from "@/utils/theme";

export default function TabsLayout() {
  const theme = useTheme();

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
