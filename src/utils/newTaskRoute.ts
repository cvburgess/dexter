import type { Href } from "expo-router";

import { getViewedDay } from "@/hooks/useViewedDay";

// Call at press time, not render time — pushing the modal blurs the day
// screen and clears the viewed day (hooks/useViewedDay.tsx) before then.
export const newTaskRoute = (): Href => {
  const viewedDay = getViewedDay();

  return viewedDay
    ? { pathname: "/new-task", params: { scheduledFor: viewedDay.toString() } }
    : "/new-task";
};
