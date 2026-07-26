import { useWindowDimensions } from "react-native";

import { WEB_RAIL_MIN_WIDTH } from "@/utils/breakpoints";

/**
 * True at or above the width where web shows the nav rail instead of the bottom
 * dock (`components/WebNav.tsx`). Separate from `useIsMultiPane` because the
 * rail's threshold has to account for the width the rail itself takes out of the
 * content — see `WEB_RAIL_MIN_WIDTH`. A thin wrapper around
 * `useWindowDimensions` for the same reason `useIsMultiPane` is one: tests mock
 * the breakpoint directly rather than React Native's window-dimensions hook.
 */
export const useShowNavRail = (): boolean => {
  const { width } = useWindowDimensions();
  return width >= WEB_RAIL_MIN_WIDTH;
};
