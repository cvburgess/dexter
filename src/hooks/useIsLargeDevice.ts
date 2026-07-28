import { useWindowDimensions } from "react-native";

import { LARGE_DEVICE_MIN_WIDTH } from "@/utils/breakpoints";

/**
 * True at or above the width where the app switches to its large-screen
 * behavior — Today's multi-column panes, Settings' sidebar + detail layout, and
 * whether the Week tab exists at all (DEX-96) all key off this. A thin wrapper
 * around `useWindowDimensions` so tests can mock the breakpoint directly
 * instead of React Native's window-dimensions hook (which jest-expo's RN module
 * doesn't mock cleanly).
 *
 * **This samples the window's *width*, and one consumer needs that to be
 * effectively fixed.** Adding or removing a `NativeTabs.Trigger` remounts the
 * tab navigator and resets every tab's state (expo-router's own warning on
 * `NativeTabTriggerProps.hidden`), so a value that flipped mid-session would
 * drop the user's place each time it did. Today it can't: `app.json` sets
 * `"orientation": "portrait"`, so width never changes under the user on a
 * phone, and both iPad orientations clear the threshold. The one live crossing
 * is an iPad Split View resize — a deliberate gesture, and one where Today and
 * Settings are visibly reflowing between single- and multi-pane anyway.
 *
 * **A foldable or otherwise resizable phone is what reopens this.** Width would
 * then change mid-session on a device that is *not* a large screen in either
 * state, and the Week tab would appear and vanish under the user. The fix at
 * that point is to sample `Math.min(width, height)` for the tab-trigger gate
 * specifically — an unfolded phone is wide but still short — while leaving the
 * layout consumers here on width, which is the figure they actually lay out
 * against. Deliberately not built ahead of a device that needs it.
 */
export const useIsLargeDevice = (): boolean => {
  const { width } = useWindowDimensions();
  return width >= LARGE_DEVICE_MIN_WIDTH;
};
