import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

// Per-device, like useTodayPanes, but its own key — sharing Today's calendar
// pane would couple the two tabs' layouts.
export const WEEK_CALENDAR_KEY = "dexter.week.calendar";

const QUERY_KEY = ["weekCalendar"];

const readShown = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(WEEK_CALENDAR_KEY)) === "true";

type TUseWeekCalendar = [boolean, { toggle: () => Promise<void> }];

/** Whether the Week tab's columns show calendar events (DEX-186). Off by
 * default — it's an overlay the user opts into. */
export const useWeekCalendar = (): TUseWeekCalendar => {
  const queryClient = useQueryClient();

  const { data = false } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: readShown,
    staleTime: Infinity,
  });

  // Waits out the first read so it can't land after (and undo) a press; the
  // updater form, not closed-over `data`, keeps rapid presses from clobbering.
  const toggle = useCallback(async () => {
    await queryClient.ensureQueryData({
      queryKey: QUERY_KEY,
      queryFn: readShown,
    });
    const next = queryClient.setQueryData<boolean>(
      QUERY_KEY,
      (prev = false) => !prev,
    );
    await AsyncStorage.setItem(WEEK_CALENDAR_KEY, String(next));
  }, [queryClient]);

  return [data, { toggle }];
};
