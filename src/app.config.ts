// DEX-85: opt-in Mac Catalyst build, gated behind `EXPO_MAC_CATALYST=1`.
//
// `app.json` remains the single source of truth — Expo passes its `expo` object
// in as `config`, and when the flag is unset this file returns that object by
// identity. Normal `expo prebuild` / `expo run:ios` / `eas build --platform ios`
// are therefore bit-for-bit unaffected (no EAS profile sets this var).
//
// The flag is read *here and nowhere else*. A plugin that loads and then no-ops
// still perturbs mod registration order, and mod order is load-bearing for the
// Xcode-project edits in `plugins/withMacCatalyst.ts`.
//
// Deliberately not named `EXPO_PUBLIC_*`: that prefix inlines the value into the
// JS bundle, and this is a build-time-only switch.
import type { ConfigContext, ExpoConfig } from "expo/config";

type TPluginEntry = NonNullable<ExpoConfig["plugins"]>[number];

/** Build all native code from source for the Catalyst target.
 *
 * Neither prebuilt-binary path works on Mac Catalyst, for two *different*
 * reasons — both upstream packaging problems, neither fixable from here:
 *
 * `usePrecompiledModules: false` — the published Expo xcframeworks
 * (`ExpoModulesCore`, `ExpoFileSystem`, `ExpoFont`, `ExpoModulesWorklets`) ship
 * only `ios-arm64` and `ios-arm64_x86_64-simulator` slices. There is no
 * `maccatalyst` slice at all, so linking fails outright. As a side effect,
 * building from source is also what lets a `patches/` edit to an Expo module's
 * Swift take effect — a precompiled binary bypasses it, which is why the
 * Catalyst-only `@expo/ui` menu patch reaches the binary here and nowhere else.
 *
 * Plain iOS builds deliberately keep the default (precompiled). `app.json` set
 * `usePrecompiledModules: false` for a while so `patches/expo-modules-core` would
 * reach shipped iOS builds; that patch landed upstream in 57.0.8 and was removed
 * in DEX-116, and no remaining patch affects a non-Catalyst iOS binary — so iOS
 * takes the faster prebuilt path again.
 *
 * `buildReactNativeFromSource: true` — React Native's prebuilt
 * `React.xcframework` and `ReactNativeDependencies.xcframework` *do* carry
 * `maccatalyst` slices, but those slices are malformed: they contain a flat
 * iOS-style bundle (real binary, `Headers/`, `Resources/` at the top level)
 * *and* a `Versions/` directory, so `codesign` rejects them with "bundle format
 * is ambiguous (could be app or framework)". A valid macOS framework symlinks
 * its top-level entries into `Versions/Current/` — which `hermesvm.xcframework`
 * does correctly, and the other two do not.
 *
 * The cost is build time: everything compiles from source on a clean build.
 */
const withSourceBuiltNativeCode = (plugin: TPluginEntry): TPluginEntry => {
  if (!Array.isArray(plugin) || plugin[0] !== "expo-build-properties") {
    return plugin;
  }
  const [name, options] = plugin as [string, { ios?: Record<string, unknown> }];
  return [
    name,
    {
      ...options,
      ios: {
        ...options?.ios,
        usePrecompiledModules: false,
        buildReactNativeFromSource: true,
      },
    },
  ];
};

/** Apply `withSourceBuiltNativeCode`, failing loudly if it matched nothing.
 *
 * Silently skipping would trade a named error here for an opaque "no
 * maccatalyst slice" link failure thousands of lines into an Xcode log. Matches
 * how `plugins/withMacCatalyst.ts` asserts on its own Podfile and pbxproj
 * anchors.
 */
const rewriteBuildProperties = (plugins: TPluginEntry[]): TPluginEntry[] => {
  const rewritten = plugins.map(withSourceBuiltNativeCode);
  if (rewritten.every((plugin, index) => plugin === plugins[index])) {
    throw new Error(
      "[app.config] EXPO_MAC_CATALYST=1 but no array-form `expo-build-properties` plugin entry was found to rewrite. Mac Catalyst needs `usePrecompiledModules: false` and `buildReactNativeFromSource: true`.",
    );
  }
  return rewritten;
};

export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.EXPO_MAC_CATALYST !== "1") return config as ExpoConfig;

  return {
    ...(config as ExpoConfig),
    plugins: [
      // Drop the widget target. `@bacons/apple-targets` hardcodes
      // `TARGETED_DEVICE_FAMILY: "1,2"` on widget targets and never sets
      // `SUPPORTS_MACCATALYST` (which `com.apple.product-type.app-extension`
      // defaults to NO), and the package has no macOS target type. It can't be
      // fixed from `withXcodeProject` either — apple-targets writes the widget
      // through its own mod, which runs *after* ours, so the target doesn't
      // exist yet when we'd want to patch it. Consequence: no Live Activity or
      // Dynamic Island on Mac, which is correct — those surfaces don't exist
      // on macOS.
      ...rewriteBuildProperties(
        (config.plugins ?? []).filter(
          (plugin) => plugin !== "@bacons/apple-targets",
        ),
      ),
      "./plugins/withMacCatalyst",
    ],
  };
};
