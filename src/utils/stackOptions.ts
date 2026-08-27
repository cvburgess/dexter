import type { NativeStackNavigationOptions } from "expo-router/build/react-navigation/native-stack";

import { Theme } from "./theme";

// A bare Stack renders a light header in dark mode without this; `background`
// so it sits flush beside the settings sidebar on large screens (DEX-61).
export function createListScreenOptions(
  theme: Theme,
  title: string,
): NativeStackNavigationOptions {
  return {
    title,
    headerTintColor: theme.colors.text,
    headerStyle: { backgroundColor: theme.colors.background },
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
    headerStyle: { backgroundColor: theme.colors.background },
    contentStyle: { backgroundColor: theme.colors.background },
  };
}
