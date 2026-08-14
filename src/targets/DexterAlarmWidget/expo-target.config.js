/**
 * Dexter's one Apple Widget Extension, hosting every widget in the app.
 *
 * It began as the alarm target: `expo-alarm-kit`'s `scheduleAlarm` schedules an
 * `AlarmAttributes<Meta>` Live Activity, and this widget registers the matching
 * `ActivityConfiguration` so iOS knows how to present it — without that the
 * scheduled activity has no associated views (DEX-48). Mirrors the setup proven
 * in magic-meal-kit's CookTimerWidget.
 *
 * DEX-83 added the home screen and lock screen task widgets here rather than in
 * a second target, and DEX-160 the habit widget. The `name` and
 * `bundleIdentifier` keep their alarm-era spelling deliberately: this extension
 * shipped in v2.0.0, and renaming either one mints a new extension bundle id and
 * provisioning profile for no gain the user can see.
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = (config) => ({
  type: "widget",
  name: "DexterAlarmWidget",
  displayName: "Dexter",
  deploymentTarget: "26.1",
  bundleIdentifier: ".alarmwidget",
  // `AppIntents` is what makes the habit rings tappable in place (DEX-160):
  // WidgetKit routes per-element taps only from `.systemMedium` up, so on the
  // small widget a `Button(intent:)` is the only interaction there is.
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit", "AlarmKit", "AppIntents"],
  // Mirror the main app's App Group so the widget shares AlarmKit state.
  entitlements: {
    "com.apple.security.application-groups": config.ios?.entitlements?.[
      "com.apple.security.application-groups"
    ] ?? ["group.com.dexterplanner"],
  },
});
