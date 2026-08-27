// DEX-85: EXPO_MAC_CATALYST=1 is read here and nowhere else — a loaded no-op
// plugin still perturbs mod order. Not EXPO_PUBLIC_*: that inlines the value.
import type { ConfigContext, ExpoConfig } from "expo/config";

import { version } from "./package.json";

type TPluginEntry = NonNullable<ExpoConfig["plugins"]>[number];

// Neither prebuilt path works on Catalyst: Expo ships no maccatalyst slice,
// RN's is malformed (codesign: "ambiguous bundle"). Plain iOS keeps precompiled (DEX-116).
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

// Fail loudly on no match — silently skipping trades a named error for an
// opaque "no maccatalyst slice" link failure deep in an Xcode log.
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
  // Version comes from package.json so `npm version` is the whole bump —
  // app.json carried a second copy until DEX-169 and the two drifted.
  const base: ExpoConfig = { ...(config as ExpoConfig), version };

  if (process.env.EXPO_MAC_CATALYST !== "1") return base;

  return {
    ...base,
    plugins: [
      // Drop the widget target: apple-targets never sets SUPPORTS_MACCATALYST
      // and its mod runs *after* ours, so the target can't be patched either.
      ...rewriteBuildProperties(
        (config.plugins ?? []).filter(
          (plugin) => plugin !== "@bacons/apple-targets",
        ),
      ),
      "./plugins/withMacCatalyst",
    ],
  };
};
