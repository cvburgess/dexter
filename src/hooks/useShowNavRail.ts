import { useWindowDimensions } from "react-native";

import { RAIL_MIN_WIDTH } from "@/utils/breakpoints";

/**
 * True at or above the width where **web** shows the nav rail instead of the
 * bottom dock (`components/AppNav.tsx`). Separate from `useIsLargeDevice`
 * because the rail's threshold has to account for the width the rail itself
 * takes out of the content — see `RAIL_MIN_WIDTH`. A thin wrapper around
 * `useWindowDimensions` for the same reason `useIsLargeDevice` is one: tests
 * mock the breakpoint directly rather than React Native's window-dimensions
 * hook.
 *
 * **Web is its only caller.** Tablets show the rail unconditionally (DEX-104)
 * and phones show the native tab bar, so this hook decides nothing on native.
 */
export const useShowNavRail = (): boolean => {
  const { width } = useWindowDimensions();
  return width >= RAIL_MIN_WIDTH;
};
