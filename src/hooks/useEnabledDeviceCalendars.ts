import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

// Per-device choice, so AsyncStorage rather than the synced preferences row.
// `null` means unset — callers treat that as "all calendars enabled".
export const ENABLED_CALENDARS_KEY = "dexter.calendar.enabledIds";

const readEnabledIds = async (): Promise<string[] | null> => {
  const raw = await AsyncStorage.getItem(ENABLED_CALENDARS_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
};

type TUseEnabledDeviceCalendars = [
  string[] | null,
  { setEnabledIds: (ids: string[]) => Promise<void>; isLoading: boolean },
];

// Shared through React Query so the settings screen and the events hook stay
// in sync and a toggle re-renders both immediately.
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
