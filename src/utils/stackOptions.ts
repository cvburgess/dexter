import { Platform } from "react-native";
import type { NativeStackNavigationOptions } from "expo-router";

import { Theme } from "./theme";

// A bare Android header renders light in dark mode without `background`
// (DEX-61); iOS 26+ keeps it unset for native Liquid Glass (SDK 58, DEX-236).
const headerStyle = (theme: Theme) =>
  Platform.select({
    android: { backgroundColor: theme.colors.background },
    ios: undefined,
  });

export function createListScreenOptions(
  theme: Theme,
  title: string,
): NativeStackNavigationOptions {
  return {
    title,
    headerTintColor: theme.colors.text,
    headerStyle: headerStyle(theme),
    contentStyle: { backgroundColor: theme.colors.background },
  };
}

// Explicit so modals under a Stack defaulting to false still render one.
export function createModalScreenOptions(
  theme: Theme,
  title: string,
): NativeStackNavigationOptions {
  return {
    title,
    presentation: "formSheet",
    headerShown: true,
    headerTintColor: theme.colors.text,
    headerStyle: headerStyle(theme),
    contentStyle: { backgroundColor: theme.colors.background },
  };
}
