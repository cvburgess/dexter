// Width (in dp) at or above which the app treats the device as a large screen
// and switches from a single-column mobile layout to its wider layouts.
// Roughly an iPad in portrait. Shared by Settings (sidebar + detail), Today
// (multi-column panes), and the Week tab (which only exists above it) so every
// one of those breakpoints stays in sync — see `hooks/useIsLargeDevice.ts`.
export const LARGE_DEVICE_MIN_WIDTH = 768;

// Width (in dp) of the web nav rail (`components/WebNav.tsx`).
export const WEB_NAV_RAIL_WIDTH = 76;

// Width (in dp) at or above which web shows the nav rail rather than the bottom
// dock. Deliberately not `LARGE_DEVICE_MIN_WIDTH`: the rail takes its width *out
// of* the tab content, while Today and Settings decide on multi-pane from the
// window width via `useIsLargeDevice`. Gating the rail on window ≥
// LARGE_DEVICE_MIN_WIDTH + rail width keeps those two in agreement — whenever
// the rail is up, the content beside it still clears the large-screen
// threshold. The dock costs height, not width, so it never has the same problem.
export const WEB_RAIL_MIN_WIDTH = LARGE_DEVICE_MIN_WIDTH + WEB_NAV_RAIL_WIDTH;

// Max width (in dp) for the Tasks pane in a multi-column layout — matches the
// app's existing wide-screen content cap (see login.tsx, oauth/consent.tsx) so
// it reads like a typical mobile screen instead of stretching edge to edge.
export const TASKS_PANE_MAX_WIDTH = 400;

// Max width (in dp) for the Calendar pane — a day timeline reads fine
// narrower than a task list, so it gets its own (smaller) cap.
export const CALENDAR_PANE_MAX_WIDTH = 240;

// Max width (in dp) for the Task Drawer pane (DEX-33) — it renders the same
// TaskCard rows as the Tasks pane, just narrower so it fits alongside
// Notes/Journal/Calendar instead of competing with Tasks for space.
export const DRAWER_PANE_MAX_WIDTH = 360;

// Min width (in dp) for one day column in the Week tab (DEX-96). The legacy
// dexter-app's "compact" column width, which is what its card-size toggle
// switched to precisely so a full week fit without horizontal scrolling. The
// columns flex above this; below it the week scrolls sideways rather than
// squeezing TaskCard past the point where its controls still fit.
export const WEEK_COLUMN_MIN_WIDTH = 160;
