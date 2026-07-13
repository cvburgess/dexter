import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export type TTodayPane = "notes" | "journal" | "calendar";

export type TTodayPanes = Record<TTodayPane, boolean>;

// Which optional panes are shown on the large-screen Today layout is a
// per-device choice (like `useEnabledDeviceCalendars`), so it lives in
// AsyncStorage rather than the Supabase `preferences` row.
export const TODAY_PANES_KEY = "dexter.today.panes";

// "Whole day at a glance" — panes default to open so the multi-column layout
// is useful (and discoverable) the first time a user sees it.
const DEFAULT_PANES: TTodayPanes = {
  notes: true,
  journal: true,
  calendar: true,
};

const isTodayPanes = (value: unknown): value is TTodayPanes =>
  typeof value === "object" &&
  value !== null &&
  (["notes", "journal", "calendar"] as const).every(
    (key) => typeof (value as Record<string, unknown>)[key] === "boolean",
  );

const readPanes = async (): Promise<TTodayPanes> => {
  const raw = await AsyncStorage.getItem(TODAY_PANES_KEY);
  if (!raw) return DEFAULT_PANES;
  try {
    const parsed = JSON.parse(raw);
    return isTodayPanes(parsed) ? parsed : DEFAULT_PANES;
  } catch {
    return DEFAULT_PANES;
  }
};

type TUseTodayPanes = [
  TTodayPanes,
  { togglePane: (pane: TTodayPane) => Promise<void>; isLoading: boolean },
];

/**
 * Which optional Today-tab panes (notes/journal/calendar) are shown in the
 * large-screen multi-column layout, persisted to the device. Shared through
 * React Query so a toggle re-renders immediately.
 */
export const useTodayPanes = (): TUseTodayPanes => {
  const queryClient = useQueryClient();

  const { data = DEFAULT_PANES, isLoading } = useQuery({
    queryKey: ["todayPanes"],
    queryFn: readPanes,
    staleTime: Infinity,
  });

  const togglePane = useCallback(
    async (pane: TTodayPane) => {
      const next = { ...data, [pane]: !data[pane] };
      await AsyncStorage.setItem(TODAY_PANES_KEY, JSON.stringify(next));
      queryClient.setQueryData(["todayPanes"], next);
    },
    [data, queryClient],
  );

  return [data, { togglePane, isLoading }];
};
