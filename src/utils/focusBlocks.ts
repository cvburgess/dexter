// Pure focus-block logic (DEX-49), shared by the api module, the timer hooks,
// and the settings picker. Deliberately import-free, so it tests with no mocking.

/** A focus block's lifecycle state — mirrors the `focus_block_status` enum. */
export type TFocusBlockStatus = "active" | "paused" | "complete" | "cancelled";

/** Matches the column default in
 * `20260813201604_add_preferences_focus_block_minutes.sql`; move both together. */
export const DEFAULT_FOCUS_BLOCK_MINUTES = 25;

/** Values are strings — `PickerField<V extends string>` requires it, read back
 * via `Number`. No CHECK constraint: an app-owned list expected to move with taste. */
export const FOCUS_BLOCK_LENGTHS: readonly {
  value: string;
  label: string;
}[] = [
  { value: "15", label: "15 minutes" },
  { value: "20", label: "20 minutes" },
  { value: "25", label: "25 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "50", label: "50 minutes" },
  { value: "60", label: "1 hour" },
];

/** A newer client can store a length this build doesn't list — the picker would
 * render nothing selected (same footgun as `resolveAlarmSound`); degrade instead. */
export const resolveFocusBlockMinutes = (minutes: number): number =>
  FOCUS_BLOCK_LENGTHS.some((option) => Number(option.value) === minutes)
    ? minutes
    : DEFAULT_FOCUS_BLOCK_MINUTES;

/** Whether a block is still on screen — running or held, as opposed to ended. */
export const isLiveFocusStatus = (status: TFocusBlockStatus): boolean =>
  status === "active" || status === "paused";

/** The stored anchor a countdown is derived from — the subset of a focus block
 * this module needs, so the math stays independent of the row's other columns. */
export type TFocusAnchor = {
  status: TFocusBlockStatus;
  remainingSeconds: number;
  resumedAt: string | null;
};

/** The anchor design: `remainingSeconds` is a snapshot at the last pause,
 * `resumedAt` when the current run began — every client subtracts, nothing writes a countdown. */
export const liveRemainingSeconds = (
  block: TFocusAnchor,
  nowMs: number,
): number => {
  if (block.status === "paused") return Math.max(0, block.remainingSeconds);
  if (block.status !== "active" || !block.resumedAt) return 0;

  // Clamped at zero: after a pause, `resumedAt` is fresher than the caller's
  // last reading, so unclamped elapsed would go negative and jump the timer up.
  const elapsedSeconds = Math.max(
    0,
    (nowMs - Date.parse(block.resumedAt)) / 1000,
  );
  return Math.max(0, block.remainingSeconds - elapsedSeconds);
};

/** Rounds up so a fresh block doesn't drop a second immediately; minutes keep
 * counting past 60 (no hours field) so the tab-bar capsule's glyph count never changes. */
export const formatCountdown = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};
