const path = require("path");

const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// getSentryExpoConfig wraps Expo's default Metro config (getDefaultConfig)
// with the annotations Sentry needs to symbolicate stack traces and upload
// source maps. Source-map upload itself is driven by the Sentry Expo config
// plugin (see app.json) during EAS Release builds and only needs the
// SENTRY_AUTH_TOKEN EAS secret set — see docs/frontend.md.
const config = getSentryExpoConfig(__dirname);

// DEX-85: Mac Catalyst POC. Gated on the same flag `app.config.ts` reads, so
// normal iOS/Android/web bundling is untouched — with the flag unset this block
// never runs and `config` is returned exactly as before.
//
// `expo-alarm-kit` is excluded from the Catalyst pod install (AlarmKit is
// `API_UNAVAILABLE(macCatalyst)`), and its JS entry calls `requireNativeModule`
// at module scope, which throws when the native module is missing. Aliasing the
// package to a no-op stub keeps that failure out of the bundle without putting
// a Catalyst branch into shipping app source.
if (process.env.EXPO_MAC_CATALYST === "1") {
  const stubs = {
    "expo-alarm-kit": path.resolve(
      __dirname,
      "macCatalystStubs/expo-alarm-kit.js",
    ),
  };

  const upstreamResolveRequest = config.resolver.resolveRequest;

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const stub = stubs[moduleName];
    if (stub) return { type: "sourceFile", filePath: stub };
    return upstreamResolveRequest
      ? upstreamResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
