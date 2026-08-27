import { useWindowDimensions } from "react-native";

import { RAIL_MIN_WIDTH } from "@/utils/breakpoints";

// True at or above the width where web shows the nav rail, not the dock.
// Separate from useIsLargeDevice: the threshold subtracts RAIL_MIN_WIDTH.
export const useShowNavRail = (): boolean => {
  const { width } = useWindowDimensions();
  return width >= RAIL_MIN_WIDTH;
};
