import { useWindowDimensions } from "react-native";

import { LARGE_DEVICE_MIN_WIDTH } from "@/utils/breakpoints";

// True at the large-screen breakpoint. Thin wrapper so tests can mock the
// breakpoint directly — samples the *window*, wider than content by the rail.
export const useIsLargeDevice = (): boolean => {
  const { width } = useWindowDimensions();
  return width >= LARGE_DEVICE_MIN_WIDTH;
};
