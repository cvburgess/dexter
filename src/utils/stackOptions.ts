import type { NativeStackNavigationOptions } from "expo-router/build/react-navigation/native-stack";

import { Theme } from "./theme";

/**
 * Options for a standard list/detail screen with a visible header, themed so
 * the navigation header and screen body follow the active color scheme. Without
 * this, a bare `<Stack>` renders the default (light) header even in dark mode.
 *
 * The header sits on `background`, the same sheet as the body below it, rather
 * than on `surfaceSunken`: a header that recedes reads as a toolbar bolted onto
 * the screen, and on a large screen it also has to sit flush beside the
 * settings sidebar (DEX-61).
 */
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

/**
 * Options for modal screens (presented as a form sheet). Native
 * implementation with a visible header — `headerShown: true` is explicit so
 * modals declared under Stacks that default to `headerShown: false` (e.g.
 * `(app)/_layout.tsx`) still render their header. The web implementation
 * (`stackOptions.web.ts`) hides the header; `WebModalHeader` is used instead.
 */
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
