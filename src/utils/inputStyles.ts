import { Platform, type TextStyle } from "react-native";

// Chrome's `outline-style: auto` ignores width/color, so zeroing width alone
// leaves the ring; `outlineStyle: "none"` is the only spelling that works.
export const NO_FOCUS_RING: TextStyle = Platform.select({
  web: { outlineStyle: "none" } as unknown as TextStyle,
  default: {},
});
