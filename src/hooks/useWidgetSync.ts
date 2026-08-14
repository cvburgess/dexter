import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useRef } from "react";

import { resolveTheme } from "@/utils/theme";
import {
  buildWidgetSnapshot,
  clearWidgetSnapshot,
  writeWidgetSnapshot,
} from "@/utils/widgets";

import { useAuth } from "./useAuth";
import { useThemePreferences } from "./usePreferences";
import { useTasks } from "./useTasks";

/**
 * Publishes the snapshot the iOS widget extension renders from (DEX-83), the
 * way `useAlarmSync` projects task alarms onto AlarmKit — and simpler, because
 * there is nothing on the other side to reconcile against: the App Group holds
 * exactly what we last wrote.
 *
 * Mounted once, high in the authenticated tree. No-ops off iOS via
 * `utils/widgets`.
 */
export const useWidgetSync = (): void => {
  const [tasks, { isLoading }] = useTasks();
  const { session } = useAuth();
  const {
    themeMode,
    lightTheme,
    darkTheme,
    isLoading: preferencesLoading,
  } = useThemePreferences();

  // The last payload handed to the App Group this session. A widget reload is
  // metered — WidgetKit spends a daily budget of roughly 40-70 refreshes on a
  // widget the user actually looks at — so an effect run that computes an
  // identical payload (a mutation to a task on some other day, an unrelated
  // preference edit, a re-render) must cost nothing.
  const published = useRef<string | null>(null);

  useEffect(() => {
    // Signed out, whether by the Log Out button or by a token the server
    // revoked. The home screen is outside the app's own UI, so it would
    // otherwise keep showing the departing user's tasks to whoever picks the
    // phone up next. Deliberately ahead of the loading gate: with no session
    // there is nothing left to wait for.
    if (!session) {
      if (published.current === null) return;
      published.current = null;
      clearWidgetSnapshot();
      return;
    }

    // Both queries serve placeholder data first — `[]` for tasks, the default
    // row for preferences. Publishing that would put an empty "All done!" on
    // the home screen in the app's default palette and then spend a second
    // reload replacing it, on every cold open (the reason `useAlarmSync` waits
    // on the same two signals).
    if (isLoading || preferencesLoading) return;

    const palettes = {
      light: resolveTheme({ themeMode, lightTheme, darkTheme }, "light").colors,
      dark: resolveTheme({ themeMode, lightTheme, darkTheme }, "dark").colors,
    };

    const snapshot = buildWidgetSnapshot(
      tasks,
      Temporal.Now.plainDateISO(),
      palettes,
    );

    // Compared as a string rather than field by field: the payload is nested,
    // and it is a string a moment later anyway.
    const serialized = JSON.stringify(snapshot);
    if (serialized === published.current) return;

    published.current = serialized;
    writeWidgetSnapshot(snapshot);
  }, [
    tasks,
    isLoading,
    session,
    preferencesLoading,
    themeMode,
    lightTheme,
    darkTheme,
  ]);
};
