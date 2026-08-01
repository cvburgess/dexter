import { Dimensions, Platform } from "react-native";

// `screen`, not `window`: the physical display. An iPad in a narrow Split View
// slice is still an iPad, and the value this feeds — which navigation shell to
// mount — must not follow the window.
const { width, height } = Dimensions.get("screen");

/**
 * True on iPad and on Android tablets; false on phones and on web.
 *
 * Read once at module scope, and deliberately a constant rather than a hook or
 * a function: the caller (`app/(app)/(tabs)/_layout.tsx`) is choosing between
 * two *navigators*, and anything that could flip at runtime would swap the
 * navigator under a running app and reset every tab's state. A function would
 * read as though it might.
 *
 * **The one device this is wrong for is an Android foldable.** `configChanges`
 * in the manifest covers `screenSize|screenLayout|smallestScreenSize`, so
 * folding doesn't even recreate the activity, let alone the JS context — this
 * value is captured at launch and never recomputed. A foldable launched folded
 * keeps the phone tab bar after it opens; launched open and then folded, it
 * keeps a 76dp rail in a ~318dp window. Restarting the app is the only
 * recovery. Accepted for now because reactivity here is the exact thing DEX-104
 * removed, and no supported device in the lineup folds; revisit by splitting
 * the decision (a stable *shell* choice, a reactive *rail* choice) rather than
 * by making this a hook.
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
