import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export type TTodayPane = "notes" | "journal" | "calendar" | "drawer";

export type TTodayPanes = Record<TTodayPane, boolean>;

// Which optional panes are shown on the large-screen Today layout is a
// per-device choice (like `useEnabledDeviceCalendars`), so it lives in
// AsyncStorage rather than the Supabase `preferences` row.
export const TODAY_PANES_KEY = "dexter.today.panes";

// "Whole day at a glance" — the original three panes default open so the
// multi-column layout is useful (and discoverable) the first time a user
// sees it. The task drawer (DEX-33) is an opt-in triage tool rather than a
// glance surface, so it defaults closed.
const DEFAULT_PANES: TTodayPanes = {
  notes: true,
  journal: true,
  calendar: true,
  drawer: false,
};

// Derived from DEFAULT_PANES (rather than a separate hand-listed array) so
// adding a pane only ever means updating one place.
const TODAY_PANE_KEYS = Object.keys(DEFAULT_PANES) as TTodayPane[];

// Only checks the keys actually present, so a device's stored value from
// before a pane was added (e.g. `drawer`) still passes — `readPanes` below
// fills in any missing keys from `DEFAULT_PANES` rather than discarding the
// user's existing notes/journal/calendar choices.
const isPartialTodayPanes = (value: unknown): value is Partial<TTodayPanes> =>
  typeof value === "object" &&
  value !== null &&
  TODAY_PANE_KEYS.every((key) => {
    const entry = (value as Record<string, unknown>)[key];
    return entry === undefined || typeof entry === "boolean";
  });

const readPanes = async (): Promise<TTodayPanes> => {
  const raw = await AsyncStorage.getItem(TODAY_PANES_KEY);
  if (!raw) return DEFAULT_PANES;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPartialTodayPanes(parsed)
      ? { ...DEFAULT_PANES, ...parsed }
      : DEFAULT_PANES;
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

  // Derives `next` from the query cache via `setQueryData`'s updater form
  // (applied synchronously) rather than the `data` closed over at the last
  // render, so two toggles fired back to back — before either's AsyncStorage
  // write resolves and re-renders this hook — each read the other's update
  // instead of clobbering it.
  const togglePane = useCallback(
    async (pane: TTodayPane) => {
      const next = queryClient.setQueryData<TTodayPanes>(
        ["todayPanes"],
        (prev = DEFAULT_PANES) => ({ ...prev, [pane]: !prev[pane] }),
      );
      if (next)
        await AsyncStorage.setItem(TODAY_PANES_KEY, JSON.stringify(next));
    },
    [queryClient],
  );

  return [data, { togglePane, isLoading }];
};
