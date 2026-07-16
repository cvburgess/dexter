import { Temporal } from "@js-temporal/polyfill";
import { useLocalSearchParams } from "expo-router";

import { TaskDrawer } from "@/components/TaskDrawer";

/**
 * Task drawer (DEX-33) presented as a native detented form sheet — see
 * `createSheetScreenOptions` in `(app)/_layout.tsx`. Hosting the shared
 * `TaskDrawer` in an ordinary route (a plain RN view tree) rather than
 * `@expo/ui`'s community bottom sheet sidesteps that library's iOS
 * `RNHostView` layout bug, which clipped the drawer's flex-width Filter/Group
 * menus. Opened via `router.push("/task-drawer?date=…")` from the Today tab's
 * `DayViewSwitcher` menu; `date` is the day the user was viewing (a snapshot —
 * the background day view is inert while the sheet is up), defaulting to today
 * if somehow absent.
 */
export default function TaskDrawerScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const viewedDate = date
    ? Temporal.PlainDate.from(date)
    : Temporal.Now.plainDateISO();

  return <TaskDrawer date={viewedDate} />;
}
