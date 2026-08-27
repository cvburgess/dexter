import type { NativeStackNavigationOptions } from "expo-router/build/react-navigation/native-stack";

import { Theme } from "./theme";

// Header shares the body's `background` rather than `surfaceSunken` — see
// the native variant for why.
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

// Hides the default header; the screen renders WebModalHeader instead.
export function createModalScreenOptions(
  theme: Theme,
  title: string,
): NativeStackNavigationOptions {
  return {
    title,
    presentation: "formSheet",
    headerShown: false,
    contentStyle: { backgroundColor: theme.colors.background },
  };
}
