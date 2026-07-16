import type { NativeStackNavigationOptions } from "expo-router/build/react-navigation/native-stack";

import { Theme } from "./theme";

/**
 * Options for a standard list/detail screen with a visible header, themed so
 * the header and screen body follow the active color scheme.
 */
export function createListScreenOptions(
  theme: Theme,
  title: string,
): NativeStackNavigationOptions {
  return {
    title,
    headerTintColor: theme.colors.text,
    headerStyle: { backgroundColor: theme.colors.card },
    contentStyle: { backgroundColor: theme.colors.background },
  };
}

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

/**
 * Web variant of the task-drawer sheet: detents/grabber are native-only, so
 * this just presents a headerless form sheet (the content owns its controls
 * and dismissal is via the platform's modal chrome).
 */
export function createSheetScreenOptions(
  theme: Theme,
): NativeStackNavigationOptions {
  return {
    presentation: "formSheet",
    headerShown: false,
    contentStyle: { backgroundColor: theme.colors.background },
  };
}
