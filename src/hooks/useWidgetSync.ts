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
  const { initializing, session } = useAuth();
  const {
    themeMode,
    lightTheme,
    darkTheme,
    isLoading: preferencesLoading,
  } = useThemePreferences();

  // A boolean, not the `Session` itself. Supabase hands back a new object on
  // every token refresh — roughly hourly for a user who never signs out — and
  // depending on it would re-run this effect each time (`app/(app)/_layout.tsx`
  // keys its own prefetch on `userId` to dodge exactly that). The payload
  // comparison below would swallow the extra runs, but the point is not to make
  // them.
  const isSignedIn = !!session;

  // The last payload handed to the App Group this session. A widget reload is
  // metered — WidgetKit spends a daily budget of roughly 40-70 refreshes on a
  // widget the user actually looks at — so an effect run that computes an
  // identical payload (a mutation to a task on some other day, an unrelated
  // preference edit, a re-render) must cost nothing.
  const published = useRef<string | null>(null);

  // Whether the App Group has already been emptied for the current signed-out
  // stretch. Separate from `published` because the two answer different
  // questions: `published` is "what did *this process* write", and the snapshot
  // that needs clearing is usually one a *previous* launch wrote.
  const cleared = useRef(false);

  useEffect(() => {
    // `session` is null while auth is still restoring, which is every cold
    // start. Clearing on that would wipe the widget on launch and repopulate it
    // a beat later — two reloads and a visible flash of the empty state.
    if (initializing) return;

    // Signed out, whether by the Log Out button or by a token the server
    // revoked while the app was closed. The home screen sits outside the app's
    // own UI, so without this it keeps showing the departing user's tasks to
    // whoever picks the phone up next. Ahead of the loading gate: with no
    // session there is nothing left to wait for.
    if (!isSignedIn) {
      if (cleared.current) return;
      clearWidgetSnapshot();
      // Recorded only once the call has returned, so a throw leaves this run
      // unmarked and the next one retries — the same reason `useAlarmSync`
      // records a scheduled alarm after AlarmKit accepts it, not before.
      cleared.current = true;
      published.current = null;
      return;
    }

    cleared.current = false;

    // Both queries serve placeholder data first — `[]` for tasks, the default
    // row for preferences. Publishing that would put an empty "All done!" on
    // the home screen in the app's default palette and then spend a second
    // reload replacing it, on every cold open (the reason `useAlarmSync` waits
    // on the same two signals).
    if (isLoading || preferencesLoading) return;

    const themePreferences = { themeMode, lightTheme, darkTheme };
    const snapshot = buildWidgetSnapshot(tasks, Temporal.Now.plainDateISO(), {
      light: resolveTheme(themePreferences, "light").colors,
      dark: resolveTheme(themePreferences, "dark").colors,
    });

    // Compared as a string rather than field by field: the payload is nested,
    // and it is a string a moment later anyway.
    const serialized = JSON.stringify(snapshot);
    if (serialized === published.current) return;

    writeWidgetSnapshot(snapshot);
    published.current = serialized;
  }, [
    tasks,
    isLoading,
    initializing,
    isSignedIn,
    preferencesLoading,
    themeMode,
    lightTheme,
    darkTheme,
  ]);
};
