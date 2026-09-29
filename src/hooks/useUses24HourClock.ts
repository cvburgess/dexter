import { useCalendars } from "expo-localization";

// The OS clock setting, read natively — Hermes's partial Intl can't report it,
// and the locale alone misses the iOS 24-Hour Time toggle. Null means 12h.
export const useUses24HourClock = (): boolean =>
  useCalendars()[0]?.uses24hourClock ?? false;
