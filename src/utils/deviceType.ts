import { Dimensions, Platform } from "react-native";

// `screen`, not `window`: the physical display. An iPad in a narrow Split View
// slice is still an iPad, and the value this feeds — which navigation shell to
// mount — must not follow the window.
const { width, height } = Dimensions.get("screen");

/**
 * True on iPad and on Android tablets; false on phones and on web.
 *
 * Read once at module scope, and deliberately a constant rather than a hook or
 * a function: a device does not change form factor mid-process, and the caller
 * (`app/(app)/(tabs)/_layout.tsx`) is choosing between two *navigators*.
 * Anything that could flip at runtime would swap the navigator under a running
 * app and reset every tab's state. A function would read as though it might.
 *
 * Android has no `isPad`, so it uses the platform's own definition of a tablet:
 * a smallest width of 600dp is `sw600dp`, the resource qualifier Android itself
 * uses to pick tablet layouts. `Math.min` rather than `width` so the answer
 * doesn't depend on which orientation the app happened to launch in.
 *
 * **Web is false by construction** — `Platform.OS` is `"web"`, so neither
 * branch matches — which is what keeps web on its own width-based rail/dock
 * split (`hooks/useShowNavRail.ts`) instead of pinning the rail the way a
 * tablet does.
 *
 * Deliberately not `expo-device`: it isn't a dependency, its Android
 * implementation is this same screen-size bucket, and adding a native module
 * would force a dev-client rebuild for three lines of arithmetic.
 */
export const IS_TABLET =
  Platform.OS === "ios"
    ? Platform.isPad
    : Platform.OS === "android" && Math.min(width, height) >= 600;
