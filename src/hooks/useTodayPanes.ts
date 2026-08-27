import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export type TTodayPane = "notes" | "calendar" | "drawer";

export type TTodayPanes = Record<TTodayPane, boolean>;

// A per-device choice (like useEnabledDeviceCalendars), so it lives in
// AsyncStorage rather than the Supabase preferences row.
export const TODAY_PANES_KEY = "dexter.today.panes";

// Display panes default open so the layout is discoverable on first view;
// the task drawer (DEX-33) is opt-in triage, so it defaults closed.
const DEFAULT_PANES: TTodayPanes = {
  notes: true,
  calendar: true,
  drawer: false,
};

// Derived from DEFAULT_PANES (rather than a separate hand-listed array) so
// adding a pane only ever means updating one place.
const TODAY_PANE_KEYS = Object.keys(DEFAULT_PANES) as TTodayPane[];

// Only checks keys actually present, so a value stored before a pane was
// added still passes; `readPanes` fills missing keys from DEFAULT_PANES.
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
    if (!isPartialTodayPanes(parsed)) return DEFAULT_PANES;
    // Built key by key, not spread over defaults, so a removed pane's stored
    // key (`journal`, DEX-105) drops instead of riding along untyped.
    return Object.fromEntries(
      TODAY_PANE_KEYS.map((key) => [key, parsed[key] ?? DEFAULT_PANES[key]]),
    ) as TTodayPanes;
  } catch {
    return DEFAULT_PANES;
  }
};

type TUseTodayPanes = [
  TTodayPanes,
  {
    togglePane: (pane: TTodayPane) => Promise<void>;
    openPane: (pane: TTodayPane) => Promise<void>;
    isLoading: boolean;
  },
];

/** Which optional Today-tab panes (notes/calendar) are shown in the
 * large-screen layout, persisted to the device via React Query. */
export const useTodayPanes = (): TUseTodayPanes => {
  const queryClient = useQueryClient();

  const { data = DEFAULT_PANES, isLoading } = useQuery({
    queryKey: ["todayPanes"],
    queryFn: readPanes,
    staleTime: Infinity,
  });

  /** Derives the next value via setQueryData's updater form (synchronous),
   * not closed-over `data`, so rapid changes don't clobber each other. */
  const updatePanes = useCallback(
    async (update: (panes: TTodayPanes) => TTodayPanes) => {
      let previous: TTodayPanes | undefined;
      const next = queryClient.setQueryData<TTodayPanes>(
        ["todayPanes"],
        (prev = DEFAULT_PANES) => {
          previous = prev;
          return update(prev);
        },
      );
      if (next && next !== previous) {
        await AsyncStorage.setItem(TODAY_PANES_KEY, JSON.stringify(next));
      }
    },
    [queryClient],
  );

  const togglePane = useCallback(
    (pane: TTodayPane) =>
      updatePanes((prev) => ({ ...prev, [pane]: !prev[pane] })),
    [updatePanes],
  );

  /** Opens a pane for a `?mode=` deep link (DEX-47) — not `togglePane` behind
   * a `panes[pane]` check, which would re-open a pane the user just closed. */
  const openPane = useCallback(
    (pane: TTodayPane) =>
      updatePanes((prev) => (prev[pane] ? prev : { ...prev, [pane]: true })),
    [updatePanes],
  );

  return [data, { togglePane, openPane, isLoading }];
};
