// DEX-85 POC scaffolding, not shipped. AlarmKit is unavailable on Catalyst,
// so the pod is excluded and this stub replaces it (unlinked would throw at import).
// Must report success (except `configure`): a `false` throws in alarms.ios.ts,
// popping a modal on every launch via useAlarmSync.ts.

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
