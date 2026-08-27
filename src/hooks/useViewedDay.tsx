import { Temporal } from "@js-temporal/polyfill";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

// Module-scoped, not context: NewTaskButton reads this at *press* time, and
// opening the modal blurs the tab before a re-render could recapture it.
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
