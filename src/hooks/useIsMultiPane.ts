import { useWindowDimensions } from "react-native";

import { TWO_PANE_MIN_WIDTH } from "@/utils/breakpoints";

/**
 * True at or above the width where Today switches to its multi-column
 * large-screen layout. A thin wrapper around `useWindowDimensions` so tests
 * can mock the breakpoint directly instead of React Native's window-dimensions
 * hook (which jest-expo's RN module doesn't mock cleanly).
 */
export const useIsMultiPane = (): boolean => {
  const { width } = useWindowDimensions();
  return width >= TWO_PANE_MIN_WIDTH;
};
