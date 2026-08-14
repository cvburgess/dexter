// DEX-85 POC scaffolding — not shipped, not part of the iOS/Android/web build.
//
// AlarmKit's symbols are annotated `API_UNAVAILABLE(macCatalyst)`. The framework
// *is* present in the Catalyst SDK slice (`iOSSupport/.../AlarmKit.framework`),
// which is misleading: every actual type — `AlarmManager`, `Alarm`,
// `AlarmPresentation`, `AlarmButton`, `AlarmAttributes`, `AlarmMetadata`,
// `AlertConfiguration` — is unavailable, producing 39 compile errors in
// `expo-alarm-kit`. So the pod is excluded from the Catalyst build
// (`use_expo_modules!(exclude: [...])`, see `plugins/withMacCatalyst.ts`).
//
// With the native module unlinked, `requireNativeModule('ExpoAlarmKit')` throws
// at *import* time, which would take down the whole bundle — `utils/alarms.ios.ts`
// imports it at module scope. Metro aliases the package to this stub instead
// (see `metro.config.js`), so no shipping app source needs a Catalyst branch.
//
// The no-op semantics mirror `utils/alarms.ts`, the existing web/Android
// implementation: scheduling is inert and succeeds silently.
//
// `scheduleAlarm`/`cancelAlarm` must report success. `utils/alarms.ios.ts:67`
// turns a `false` into a thrown error, and `hooks/useAlarmSync.ts` responds to
// a throw by leaving the id out of `scheduled.current` *and* raising an
// "Alarm not set" alert. Returning `false` here would therefore pop a modal at
// launch — and again on every reconcile, forever — for anyone whose tasks
// already carry alarms set on their iPhone. `configure()` is the exception:
// `alarms.ios.ts` treats a `false` from it as a soft failure and only warns.
//
// If Catalyst graduates from POC to shipping, this stub should be deleted and
// replaced by real branching in `utils/alarms.ios.ts` — a Mac has no alarm
// surface, so the honest long-term answer is that `alarms.ts`' no-op
// implementation should be selected on Catalyst.

export const AuthorizationStatus = {
  notDetermined: "notDetermined",
  denied: "denied",
  authorized: "authorized",
};

/** Mirrors a failed App Group configuration — callers already warn on `false`. */
export function configure() {
  return false;
}

export async function requestAuthorization() {
  return "denied";
}

/** Inert, but must report success — see the header note on the alert loop. */
export async function scheduleAlarm() {
  return true;
}

/** Inert, but must report success — `utils/alarms.ios.ts`'s `scheduleFocusAlarm`
 * throws on `false` and `hooks/useFocusAlarmSync.ts` alerts on the throw. */
export async function scheduleTimerAlarm() {
  return true;
}

export async function cancelAlarm() {
  return true;
}

export function getAllAlarms() {
  return [];
}

export default {
  configure,
  requestAuthorization,
  scheduleAlarm,
  scheduleTimerAlarm,
  cancelAlarm,
  getAllAlarms,
};
