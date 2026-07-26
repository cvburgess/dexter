import type { Href } from "expo-router";

import { getViewedDay } from "@/hooks/useViewedDay";

/**
 * The route to the create-task modal, seeded with the day currently on screen.
 *
 * **Call this at press time, not at render time.** Pushing the modal blurs the
 * focused day screen, which clears the viewed day (`hooks/useViewedDay.tsx`), so
 * a value read any earlier or later would always fall back to today. Shared by
 * every create-task entry point — `NewTaskButton` (the iOS tab-bar accessory)
 * and `WebNav`'s rail/dock "+" — so that contract lives in one place.
 */
export const newTaskRoute = (): Href => {
  const viewedDay = getViewedDay();

  return viewedDay
    ? { pathname: "/new-task", params: { scheduledFor: viewedDay.toString() } }
    : "/new-task";
};
