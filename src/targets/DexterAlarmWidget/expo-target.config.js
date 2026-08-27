// Dexter's one Widget Extension, hosting every widget. `name`/`bundleIdentifier`
// keep their v2.0.0 alarm-era spelling — renaming either mints a new bundle id.
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = (config) => ({
  type: "widget",
  name: "DexterAlarmWidget",
  displayName: "Dexter",
  deploymentTarget: "26.1",
  bundleIdentifier: ".alarmwidget",
  // AppIntents makes habit rings tappable (DEX-160): WidgetKit routes taps
  // only from .systemMedium up, so small needs a Button(intent:) instead.
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit", "AlarmKit", "AppIntents"],
  // Mirror the main app's App Group so the widget shares AlarmKit state.
  entitlements: {
    "com.apple.security.application-groups": config.ios?.entitlements?.[
      "com.apple.security.application-groups"
    ] ?? ["group.com.dexterplanner"],
  },
});
