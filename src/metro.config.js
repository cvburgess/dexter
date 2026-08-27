const path = require("path");

const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// Wraps Expo's default Metro config with Sentry's stack-trace annotations;
// source-map upload itself is the Sentry Expo config plugin during EAS builds.
const config = getSentryExpoConfig(__dirname);

// DEX-85: gated on the same flag app.config.ts reads. expo-alarm-kit is
// excluded from the Catalyst pod and throws at import if unlinked — alias to a stub.
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
