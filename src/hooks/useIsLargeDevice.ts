import { useWindowDimensions } from "react-native";

import { LARGE_DEVICE_MIN_WIDTH } from "@/utils/breakpoints";

/**
 * True at or above the width where the app switches to its large-screen
 * behavior — Today's multi-column panes, Settings' sidebar + detail layout, and
 * whether the Week destination is offered (DEX-96) all key off this. A thin
 * wrapper around `useWindowDimensions` so tests can mock the breakpoint
 * directly instead of React Native's window-dimensions hook (which jest-expo's
 * RN module doesn't mock cleanly).
 *
 * **Every consumer is now a layout, and layouts are happy to follow width
 * live.** This used to also gate a `NativeTabs.Trigger`, which was the one
 * consumer that needed the value to be effectively fixed: changing the trigger
 * set unregisters routes and remounts the tab navigator, resetting every tab's
 * state (expo-router's own warning on `NativeTabTriggerProps.hidden`). DEX-104
 * removed that coupling — navigation is chosen by form factor
 * (`utils/deviceType.ts`), and the surfaces that show Week register its route
 * unconditionally in `components/AppShell.tsx` — so the Week *nav item* now
 * appearing and vanishing across the breakpoint costs one `Pressable` in the
 * rail rather than the user's place in the app. A foldable phone is no longer a
 * problem waiting to happen here.
 *
 * **This samples the *window*, which on a tablet is wider than the content.**
 * The rail takes 76dp out of the content at every width, so between
 * `LARGE_DEVICE_MIN_WIDTH` and `RAIL_MIN_WIDTH` of window (e.g. an 11" iPad in
 * portrait at 820dp) the large-screen layouts engage against 76dp less room
 * than they measured. Accepted when DEX-104 chose an always-present rail over a
 * moving one; `RAIL_MIN_WIDTH` carries the numbers. If it reads badly on
 * device, subtract the rail's width here rather than at the ~15 call sites.
 */
export const useIsLargeDevice = (): boolean => {
  const { width } = useWindowDimensions();
  return width >= LARGE_DEVICE_MIN_WIDTH;
};
