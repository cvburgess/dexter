/**
 * Apple Widget Extension that renders Dexter task alarms on the Lock Screen and
 * in the Dynamic Island. `expo-alarm-kit`'s `scheduleAlarm` schedules an
 * `AlarmAttributes<Meta>` Live Activity; this widget registers the matching
 * `ActivityConfiguration` so iOS knows how to present it. Without this target
 * the scheduled activity has no associated views (DEX-48). Mirrors the setup
 * proven in magic-meal-kit's CookTimerWidget.
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = (config) => ({
  type: "widget",
  name: "DexterAlarmWidget",
  displayName: "Dexter Alarm",
  deploymentTarget: "26.1",
  bundleIdentifier: ".alarmwidget",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit", "AlarmKit"],
  // Mirror the main app's App Group so the widget shares AlarmKit state.
  entitlements: {
    "com.apple.security.application-groups": config.ios?.entitlements?.[
      "com.apple.security.application-groups"
    ] ?? ["group.com.dexterplanner"],
  },
});
