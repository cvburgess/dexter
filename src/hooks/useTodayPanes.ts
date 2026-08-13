import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export type TTodayPane = "drawer";

export type TTodayPanes = Record<TTodayPane, boolean>;

// Whether the docked pane is shown on the large-screen Today layout is a
// per-device choice (like `useEnabledDeviceCalendars`), so it lives in
// AsyncStorage rather than the Supabase `preferences` row.
//
// It was `notes`/`calendar`/`drawer` until DEX-152 retired the header's pane
// toggles: Notes and Calendar are now shown whenever they're enabled in
// settings, which is a synced preference, leaving the drawer as the only pane
// with a per-device answer. The key is unchanged so the choice survives the
// narrowing — see `readPanes` on what happens to the two stored keys.
export const TODAY_PANES_KEY = "dexter.today.panes";

// The task drawer (DEX-33) is an opt-in triage tool rather than a glance
// surface, so it defaults closed.
const DEFAULT_PANES: TTodayPanes = {
  drawer: false,
};

// Derived from DEFAULT_PANES (rather than a separate hand-listed array) so
// adding a pane only ever means updating one place.
const TODAY_PANE_KEYS = Object.keys(DEFAULT_PANES) as TTodayPane[];

// Only checks the keys actually present, so a device's stored value from
// before a pane was added still passes — `readPanes` below fills in any missing
// keys from `DEFAULT_PANES` rather than discarding the user's existing choices.
// It says nothing about a key for a pane that has since been *removed*
// (`journal`, DEX-105; `notes`/`calendar`, DEX-152): unknown keys are simply
// not examined here, and `readPanes` drops them.
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
    // Built key by key from `TODAY_PANE_KEYS` rather than spread over the
    // defaults, so a stored key for a pane that has since been *removed*
    // (`journal`, DEX-105; `notes`/`calendar`, DEX-152) is dropped instead of
    // riding along in a value typed as `TTodayPanes`. The next write then
    // clears it from storage too — which is why narrowing this type needs no
    // migration.
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

/**
 * Which optional Today-tab panes — the task drawer, and only it since DEX-152 —
 * are shown in the large-screen multi-column layout, persisted to the device.
 * Shared through React Query so a toggle re-renders immediately.
 */
export const useTodayPanes = (): TUseTodayPanes => {
  const queryClient = useQueryClient();

  const { data = DEFAULT_PANES, isLoading } = useQuery({
    queryKey: ["todayPanes"],
    queryFn: readPanes,
    staleTime: Infinity,
  });

  /**
   * The one write path: applies `update` to the cached panes and persists the
   * result.
   *
   * Derives the next value from the query cache via `setQueryData`'s updater
   * form (applied synchronously) rather than the `data` closed over at the last
   * render, so two changes fired back to back — before either's AsyncStorage
   * write resolves and re-renders this hook — each read the other's update
   * instead of clobbering it. An updater that returns its input unchanged skips
   * the storage write entirely.
   */
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

  /**
   * Opens a pane if it isn't already, for a `?mode=` deep link from the Search
   * tab (DEX-47).
   *
   * Idempotent on purpose, and deliberately *not* `togglePane` behind a
   * `panes[pane]` check at the call site: that check would have to read `panes`,
   * which would put it in the caller's effect dependencies — so every later pane
   * toggle would re-run the effect and re-open a pane the user had just closed.
   * Returning `prev` unchanged when the pane is already open keeps this callback
   * stable and the caller's dependency list down to the route params.
   */
  const openPane = useCallback(
    (pane: TTodayPane) =>
      updatePanes((prev) => (prev[pane] ? prev : { ...prev, [pane]: true })),
    [updatePanes],
  );

  return [data, { togglePane, openPane, isLoading }];
};
