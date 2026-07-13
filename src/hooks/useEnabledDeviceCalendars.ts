import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

// Which device calendars are shown is a per-device choice (the issue: "only
// saved to device"), so it lives in AsyncStorage rather than the Supabase
// `preferences` row. `null` means "no choice saved yet" — callers treat that as
// "all calendars enabled" so the timeline works before the user customizes it.
export const ENABLED_CALENDARS_KEY = "dexter.calendar.enabledIds";

const readEnabledIds = async (): Promise<string[] | null> => {
  const raw = await AsyncStorage.getItem(ENABLED_CALENDARS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
};

type TUseEnabledDeviceCalendars = [
  string[] | null,
  { setEnabledIds: (ids: string[]) => Promise<void>; isLoading: boolean },
];

/**
 * The set of device-calendar ids the user has chosen to show, persisted to the
 * device. Shared through React Query so the settings screen and the events hook
 * stay in sync and a toggle re-renders both immediately.
 */
export const useEnabledDeviceCalendars = (): TUseEnabledDeviceCalendars => {
  const queryClient = useQueryClient();

  const { data = null, isLoading } = useQuery({
    queryKey: ["enabledDeviceCalendars"],
    queryFn: readEnabledIds,
    staleTime: Infinity,
  });

  const setEnabledIds = useCallback(
    async (ids: string[]) => {
      await AsyncStorage.setItem(ENABLED_CALENDARS_KEY, JSON.stringify(ids));
      queryClient.setQueryData(["enabledDeviceCalendars"], ids);
    },
    [queryClient],
  );

  return [data, { setEnabledIds, isLoading }];
};
