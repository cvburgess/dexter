const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// getSentryExpoConfig wraps Expo's default Metro config (getDefaultConfig)
// with the annotations Sentry needs to symbolicate stack traces and upload
// source maps. Source-map upload itself is driven by the Sentry Expo config
// plugin (see app.json) during EAS Release builds and only needs the
// SENTRY_AUTH_TOKEN EAS secret set — see docs/frontend.md.
module.exports = getSentryExpoConfig(__dirname);
