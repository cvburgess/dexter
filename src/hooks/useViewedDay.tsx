import { Temporal } from "@js-temporal/polyfill";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

// The day the user is currently viewing, so the app-wide "New Task" flow can
// default a new task's schedule to it. Kept in a module-scoped variable rather
// than React context because the value has to be read at *press* time:
// NewTaskButton renders in the NativeTabs bottom accessory, and opening the
// modal blurs the tab that publishes the day, so a value captured during render
// would already be stale by the time the press is handled. `null` means no day
// is on screen (Settings/Search, cold start), where creation falls back to
// today.
//
// (An earlier version of this comment said context could not reach the
// accessory. It can — react-native-screens renders the accessory's children
// in-tree, wrapped in expo-router's placement context. What *is* true, and
// matters for anything else mounted there, is that it renders them **twice**,
// once per placement; see `useFocusTimer.tsx`.)
let viewedDay: Temporal.PlainDate | null = null;

/** The day currently on screen, or `null` when none. Read at the moment of use. */
export const getViewedDay = () => viewedDay;

const setViewedDay = (day: Temporal.PlainDate | null) => {
  viewedDay = day;
};

/**
 * Publishes `date` as the viewed day while the calling screen is focused, and
 * clears it on blur. A screen showing a specific day (Today) passes that day;
 * switching to another tab blurs it, so "New Task" from elsewhere falls back to
 * today (focus-based, not last-viewed). NewTaskButton reads the value at press
 * time, before pushing the modal blurs the tab and clears it.
 */
export const usePublishViewedDay = (date: Temporal.PlainDate) => {
  useFocusEffect(
    useCallback(() => {
      setViewedDay(date);
      return () => setViewedDay(null);
    }, [date]),
  );
};
