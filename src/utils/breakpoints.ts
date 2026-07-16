// Width (in dp) at or above which the app switches from a single-column
// mobile layout to a wider multi-pane layout. Roughly an iPad in portrait.
// Shared by Settings (sidebar + detail) and Today (multi-column panes) so
// both breakpoints stay in sync.
export const TWO_PANE_MIN_WIDTH = 768;

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
