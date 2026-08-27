import { Dimensions, Platform } from "react-native";

// `screen`, not `window`: an iPad in Split View is still an iPad, and this
// feeds which navigation shell mounts — it must not follow the window.
const { width, height } = Dimensions.get("screen");

// A constant, not a hook: it picks a navigator, and flipping at runtime would
// reset every tab's state. Mac Catalyst counts as a tablet (DEX-85, idiom `mac`).
export const IS_TABLET =
  Platform.OS === "ios"
    ? Platform.isPad || Platform.isMacCatalyst
    : Platform.OS === "android" && Math.min(width, height) >= 600;
