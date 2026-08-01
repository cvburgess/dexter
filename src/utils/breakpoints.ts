// Width (in dp) at or above which the app treats the device as a large screen
// and switches from a single-column mobile layout to its wider layouts.
// Roughly an iPad in portrait. Shared by Settings (sidebar + detail), Today
// (multi-column panes), and the Week tab (which only exists above it) so every
// one of those breakpoints stays in sync — see `hooks/useIsLargeDevice.ts`.
export const LARGE_DEVICE_MIN_WIDTH = 768;

// Width (in dp) of the nav rail (`components/AppNav.tsx`).
export const NAV_RAIL_WIDTH = 76;

// The rail's tile and glyph, in dp. Ported one-for-one from the legacy
// dexter-app's `DesktopNav` (a `size-12` tile holding a 26dp Phosphor icon),
// which is why they sit here beside the rail width they're proportioned
// against rather than on the density scale: the rail's geometry answers to the
// legacy desktop app, not to a control size derived from the density tier.
// Anything smaller reads as a toolbar button rather than a destination — see
// `docs/design.md`. The 48dp tile also clears the 44pt iOS minimum tap target,
// which is what makes the rail touch-legal on a tablet (DEX-104).
export const NAV_TILE_SIZE = 48;
export const NAV_ICON_SIZE = 26;

// Width (in dp) at or above which **web** shows the nav rail rather than the
// bottom dock. Deliberately not `LARGE_DEVICE_MIN_WIDTH`: the rail takes its
// width *out of* the tab content, while Today and Settings decide on multi-pane
// from the window width via `useIsLargeDevice`. Gating the rail on window ≥
// LARGE_DEVICE_MIN_WIDTH + rail width keeps those two in agreement — whenever
// the rail is up, the content beside it still clears the large-screen
// threshold. The dock costs height, not width, so it never has the same problem.
//
// **Web only, despite the un-prefixed name.** Tablets show the rail at every
// width and bypass this gate entirely (DEX-104), so between 768 and 844dp of
// window they run the large-screen layouts against 692–768dp of content — an
// accepted trade for navigation that never moves. If that reads badly on
// device, the fix is to subtract the rail width inside `useIsLargeDevice`,
// which leaves its call sites untouched.
export const RAIL_MIN_WIDTH = LARGE_DEVICE_MIN_WIDTH + NAV_RAIL_WIDTH;

// Width (in dp) of the Tasks pane in a multi-column layout — fixed, not a cap:
// the list holds its size and the panes beside it absorb whatever the window
// gives or takes (DEX-111). A task card is the same object on every screen, and
// letting it stretch with the window made it a different shape on every one.
//
// The legacy dexter-app's `w-standard` (`src/app.css`), which is
// `calc(var(--spacing) * 70)` = 70 × 4px against Tailwind v4's default
// `--spacing`. `Column.tsx` gives it to the task column in both the board and
// day views. The same arithmetic puts `w-compact` at 160, which is exactly what
// `WEEK_COLUMN_MIN_WIDTH` below was independently pinned to — so the conversion
// is corroborated rather than assumed.
//
// Coincides with `TASK_LIST_PANE_MIN_WIDTH`, but is not the same idea: that one
// is the floor a *flexing* drawer stops shrinking at. These are free to diverge.
export const TASKS_PANE_WIDTH = 280;

// Max width (in dp) for the Calendar pane — a day timeline reads fine
// narrower than a task list, so it gets its own (smaller) cap.
export const CALENDAR_PANE_MAX_WIDTH = 240;

// Max width (in dp) for the Task Drawer pane (DEX-33) — it renders the same
// TaskCard rows as the Tasks pane, just narrower so it fits alongside
// Notes/Journal/Calendar instead of competing with Tasks for space.
export const DRAWER_PANE_MAX_WIDTH = 360;

// Min width (in dp) for a docked task-drawer pane, on both Today and Week.
// (Today's own Tasks pane no longer flexes at all — see `TASKS_PANE_WIDTH`.)
// These panes stop shrinking here and the flexing panes beside them give up the
// space instead. Not a
// TaskCard minimum: the Week tab's day columns render the same cards far
// narrower (`WEEK_COLUMN_MIN_WIDTH`), trading a cramped card for seeing seven
// days at once. This is where a *list* pane, with its filter and search chrome,
// stops reading as one.
export const TASK_LIST_PANE_MIN_WIDTH = 280;

// Min width (in dp) for one day column in the Week tab (DEX-96). The legacy
// dexter-app's "compact" column width, which is what its card-size toggle
// switched to precisely so a full week fit without horizontal scrolling. The
// columns flex above this; below it the week scrolls sideways rather than
// squeezing TaskCard past the point where its controls still fit.
export const WEEK_COLUMN_MIN_WIDTH = 160;
