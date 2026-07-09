import { Temporal } from "@js-temporal/polyfill";
import { useFocusEffect } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

type ViewedDayContextType = {
  /** The day the user is currently looking at, or `null` when no day is on screen. */
  viewedDay: Temporal.PlainDate | null;
  setViewedDay: (day: Temporal.PlainDate | null) => void;
};

const ViewedDayContext = createContext<ViewedDayContextType>({
  viewedDay: null,
  setViewedDay: () => {},
});

/**
 * Tracks the day the user is viewing so the app-wide "New Task" flow can default
 * a new task's schedule to it. Lives above both the tabs and the create-task
 * modal (mounted in `(app)/_layout`) so the modal can read a value the Today
 * screen published. `null` means no day is on screen — e.g. the Settings or
 * Search tab — in which case creation falls back to today.
 */
export const ViewedDayProvider = ({ children }: { children: ReactNode }) => {
  const [viewedDay, setViewedDay] = useState<Temporal.PlainDate | null>(null);
  const value = useMemo(() => ({ viewedDay, setViewedDay }), [viewedDay]);

  return (
    <ViewedDayContext.Provider value={value}>
      {children}
    </ViewedDayContext.Provider>
  );
};

/** The day currently on screen, or `null` when none (Settings/Search, cold start). */
export const useViewedDay = () => useContext(ViewedDayContext).viewedDay;

/**
 * Publishes `date` as the viewed day while the calling screen is focused, and
 * clears it on blur. A screen showing a specific day (Today) passes that day;
 * because switching to another tab blurs this screen, the value is cleared and
 * "New Task" from elsewhere falls back to today (focus-based, not last-viewed).
 */
export const usePublishViewedDay = (date: Temporal.PlainDate) => {
  const { setViewedDay } = useContext(ViewedDayContext);

  useFocusEffect(
    useCallback(() => {
      setViewedDay(date);
      return () => setViewedDay(null);
    }, [date, setViewedDay]),
  );
};
