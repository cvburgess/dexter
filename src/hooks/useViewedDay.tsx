import { Temporal } from "@js-temporal/polyfill";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

// The day the user is currently viewing, so the app-wide "New Task" flow can
// default a new task's schedule to it. Kept in a module-scoped variable rather
// than React context because NewTaskButton renders inside a NativeTabs bottom
// accessory, which react-native-screens hosts in a native view *outside* the
// app's provider tree — context wouldn't reach it there. `null` means no day is
// on screen (Settings/Search, cold start), where creation falls back to today.
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
