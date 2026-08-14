import { Temporal } from "@js-temporal/polyfill";
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

/**
 * Publishes the snapshots the iOS widget extension renders from (DEX-83, and
 * habits in DEX-160), the way `useAlarmSync` projects task alarms onto AlarmKit
 * — and simpler, because there is nothing on the other side to reconcile
 * against: the App Group holds exactly what we last wrote.
 *
 * The two payloads live on separate keys and reload separately, so a task edit
 * never spends the habits widget's metered reloads and a habit tap never spends
 * the task widget's. They share this hook anyway, because "is it safe to
 * publish yet" — restoring, signed out, still on placeholder data — is one
 * question, and answering it twice is how the two answers drift apart.
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

  const { enableHabits, isLoading: habitsEnabledLoading } =
    useHabitsEnabledPreference();

  // Every non-archived habit, paused ones included — `buildHabitWidgetSnapshot`
  // applies the paused/archived/weekday filter itself, once per day it carries,
  // and a pre-filtered list could only answer for one of the four.
  const [habits, { isLoading: habitsLoading }] = useHabits();

  // Today's rows supply the progress the rings are filled to; the habits above
  // supply which rings exist.
  const today = Temporal.Now.plainDateISO();
  const { dailyHabits, isLoading: dailyHabitsLoading } = useDailyHabitProgress(
    today.toString(),
  );

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

  // The habits payload's own record of the same thing. Two refs, not one, for
  // the reason the two keys exist at all: a habit tapped on the home screen
  // must not make the task widget redraw, and vice versa.
  const publishedHabits = useRef<string | null>(null);

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
      // Takes the pending queue with it: a step tapped by the departing user is
      // no longer anyone's to persist once the session it belonged to is gone.
      clearHabitWidgetSnapshot();
      // Recorded only once the calls have returned, so a throw leaves this run
      // unmarked and the next one retries — the same reason `useAlarmSync`
      // records a scheduled alarm after AlarmKit accepts it, not before.
      cleared.current = true;
      published.current = null;
      publishedHabits.current = null;
      return;
    }

    cleared.current = false;

    // Every query serves placeholder data first — `[]` for tasks and habits,
    // the default row for preferences. Publishing that would put an empty "All
    // done!" on the home screen in the app's default palette and then spend a
    // second reload replacing it, on every cold open (the reason `useAlarmSync`
    // waits on the same signals). One gate for both payloads: they resolve
    // within a moment of each other on a cold start, and while we wait the
    // widgets show the *previous* snapshot rather than an empty state.
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

    // An empty habit list rather than a skipped write when the feature is off:
    // the switch can be turned off *after* a snapshot was published, and a
    // widget left on the home screen would otherwise keep showing rings for a
    // feature the app no longer has.
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
    // `today` is a fresh `Temporal.PlainDate` on every render and would make
    // this effect run each time; the payload comparison above absorbs that, but
    // the date only moves at midnight — and the widget's own timeline is what
    // handles the rollover (DEX-83), not a re-run here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tasks,
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
