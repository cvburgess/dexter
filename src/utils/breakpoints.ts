// Width (in dp) at or above which the app switches to its wider layouts —
// roughly an iPad in portrait. Shared via `hooks/useIsLargeDevice.ts`.
export const LARGE_DEVICE_MIN_WIDTH = 768;

// Max width (in dp) of a `SwipeablePage` (DEX-138). A reading measure, not an
// alias of `LARGE_DEVICE_MIN_WIDTH` (a shape threshold) — free to diverge.
export const SWIPEABLE_PAGE_MAX_WIDTH = 768;

// Width (in dp) of the nav rail (`components/AppNav.tsx`).
export const NAV_RAIL_WIDTH = 76;

// The rail's tile and glyph, ported one-for-one from legacy `DesktopNav` — the
// rail answers to it, not the density scale. 48dp clears iOS's 44pt (DEX-104).
export const NAV_TILE_SIZE = 48;
export const NAV_ICON_SIZE = 26;

// Max width (in dp) of the floating focus timer bar (DEX-49) — a reading
// measure at now-playing proportions, deliberately not a desktop-window span.
export const FOCUS_TIMER_MAX_WIDTH = 440;

// Material 3's fixed 80dp Android nav bar, which `FocusTimerDock` anchors above
// (DEX-49). iOS's bar floats and minimizes, so it hosts the timer in an accessory.
export const ANDROID_TAB_BAR_HEIGHT = 80;

// Width at or above which **web** shows the rail (tablets bypass this, DEX-104).
// Threshold + rail, since the rail takes its width *out of* the tab content.
export const RAIL_MIN_WIDTH = LARGE_DEVICE_MIN_WIDTH + NAV_RAIL_WIDTH;

// Tasks pane width — fixed, not a cap: panes beside it flex instead (DEX-111).
// Legacy `w-standard` (70 × 4px). Not `TASK_LIST_PANE_MIN_WIDTH`, a flex floor.
export const TASKS_PANE_WIDTH = 280;

// Max width (in dp) for the Calendar pane — a day timeline reads fine
// narrower than a task list, so it gets its own (smaller) cap.
export const CALENDAR_PANE_MAX_WIDTH = 240;

// Max width (in dp) for the Task Drawer pane (DEX-33) — the Tasks pane's rows,
// narrower so it fits alongside Notes/Journal/Calendar.
export const DRAWER_PANE_MAX_WIDTH = 360;

// Floor where a docked *list* pane — filter and search chrome included — stops
// reading as one; flexing panes give up space instead. Not a TaskCard minimum.
export const TASK_LIST_PANE_MIN_WIDTH = 280;

// Min width for one Week day column (DEX-96): legacy "compact" width. Below it
// the week scrolls sideways rather than squeezing TaskCard's controls.
export const WEEK_COLUMN_MIN_WIDTH = 160;
