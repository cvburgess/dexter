/**
 * The one App Group Dexter's iOS targets share, and the only place its literal
 * is written on the JS side.
 *
 * Four things must agree on this string, and only one of them is TypeScript:
 * the app's own entitlement and the widget extension's (`app.json` →
 * `ios.entitlements`, mirrored by `targets/DexterAlarmWidget/expo-target.config.js`),
 * `expo-share-intent`'s `iosAppGroupIdentifier`, and the AlarmKit dismiss intent
 * that `configureAlarms` points at it. Changing it means changing all of them —
 * a mismatch is silent, since `UserDefaults(suiteName:)` for an unentitled group
 * simply returns nothing rather than failing.
 *
 * Import-free on purpose: `utils/alarms.shared.ts` and `utils/widgets.shared.ts`
 * both read it, and neither should pull the other in to get it.
 */
export const APP_GROUP = "group.com.dexterplanner";
