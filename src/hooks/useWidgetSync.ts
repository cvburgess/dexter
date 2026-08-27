import { useEffect, useRef } from "react";

import { resolveTheme } from "@/utils/theme";
import {
  buildHabitWidgetSnapshot,
  buildWidgetSnapshot,
  clearHabitWidgetSnapshot,
  clearWidgetSnapshot,
  writeHabitWidgetSnapshot,
  writeWidgetSnapshot,
} from "@/utils/widgets";

import { useAuth } from "./useAuth";
import { useDailyHabitProgress, useHabits } from "./useHabits";
import {
  useHabitsEnabledPreference,
  useThemePreferences,
} from "./usePreferences";
import { useTasks } from "./useTasks";
import { useToday } from "./useToday";

// Publishes the iOS widget snapshots (tasks DEX-83, habits DEX-160) on
// separate keys, sharing one "safe to publish yet" gate so they can't drift.
export const useWidgetSync = (): void => {
  const [tasks, { isLoading }] = useTasks();
  const { initializing, session } = useAuth();
  const {
    themeMode,
    lightTheme,
    darkTheme,
    isLoading: preferencesLoading,
  } = useThemePreferences();

  const { enableHabits, isLoading: habitsEnabledLoading } =
    useHabitsEnabledPreference();

  // Unfiltered on purpose: `buildHabitWidgetSnapshot` applies the paused/
  // archived/weekday filter itself, once per day the snapshot carries.
  const [habits, { isLoading: habitsLoading }] = useHabits();

  // Subscribed rather than read from the clock (DEX-161) so a day change
  // re-slices both snapshots — the widget's timeline can't fix a stale window.
  const today = useToday();
  const { dailyHabits, isLoading: dailyHabitsLoading } = useDailyHabitProgress(
    today.toString(),
  );

  // A boolean, not the `Session` itself: Supabase mints a new object on every
  // token refresh (~hourly), which would re-run this effect each time.
  const isSignedIn = !!session;

  // Last payload written. WidgetKit meters reloads (~40-70/day), so an effect
  // run that computes an identical payload must cost nothing.
  const published = useRef<string | null>(null);

  // Two refs, not one, for the reason the two keys exist: a habit tap must not
  // make the task widget redraw, and vice versa.
  const publishedHabits = useRef<string | null>(null);

  // Whether the App Group was emptied this signed-out stretch. Separate from
  // `published`: the snapshot needing clearing is usually a previous launch's.
  const cleared = useRef(false);

  useEffect(() => {
    // `session` is null while auth restores on every cold start; clearing then
    // would wipe and repopulate the widget — two reloads and a visible flash.
    if (initializing) return;

    // Signed out: without this the home screen keeps showing the departing
    // user's tasks. Ahead of the loading gate — no session, nothing to wait for.
    if (!isSignedIn) {
      if (cleared.current) return;
      clearWidgetSnapshot();
      // Takes the pending queue with it: a step tapped by the departing user is
      // no longer anyone's to persist once the session it belonged to is gone.
      clearHabitWidgetSnapshot();
      // Recorded after the calls return, so a throw leaves this run unmarked
      // and the next one retries (the same pattern as `useAlarmSync`).
      cleared.current = true;
      published.current = null;
      publishedHabits.current = null;
      return;
    }

    cleared.current = false;

    // Placeholder data must not publish: it would flash an empty "All done!"
    // and spend a second metered reload replacing it, on every cold open.
    if (
      isLoading ||
      preferencesLoading ||
      habitsEnabledLoading ||
      habitsLoading ||
      dailyHabitsLoading
    ) {
      return;
    }

    const themePreferences = { themeMode, lightTheme, darkTheme };
    const palettes = {
      light: resolveTheme(themePreferences, "light").colors,
      dark: resolveTheme(themePreferences, "dark").colors,
    };

    const snapshot = buildWidgetSnapshot(tasks, today, palettes);

    // Compared as a string rather than field by field: the payload is nested,
    // and it is a string a moment later anyway.
    const serialized = JSON.stringify(snapshot);
    if (serialized !== published.current) {
      writeWidgetSnapshot(snapshot);
      published.current = serialized;
    }

    // An empty list, not a skipped write, when habits are off: a snapshot
    // published before the switch flipped would otherwise show rings forever.
    const habitSnapshot = buildHabitWidgetSnapshot(
      enableHabits ? habits : [],
      enableHabits ? dailyHabits : [],
      today,
      palettes,
    );

    const serializedHabits = JSON.stringify(habitSnapshot);
    if (serializedHabits !== publishedHabits.current) {
      writeHabitWidgetSnapshot(habitSnapshot);
      publishedHabits.current = serializedHabits;
    }
  }, [
    tasks,
    today,
    isLoading,
    initializing,
    isSignedIn,
    preferencesLoading,
    themeMode,
    lightTheme,
    darkTheme,
    enableHabits,
    habitsEnabledLoading,
    habits,
    habitsLoading,
    dailyHabits,
    dailyHabitsLoading,
  ]);
};
