import type { NativeStackNavigationOptions } from "expo-router/build/react-navigation/native-stack";

import { Theme } from "./theme";

/**
 * Options for modal screens. Web implementation hides the default header —
 * the screen renders `WebModalHeader` (Cancel/Save bar) instead.
 */
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
