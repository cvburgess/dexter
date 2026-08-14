// Pure focus-block logic (DEX-49), shared by the api module, the timer hooks,
// and the settings picker, and unit-tested directly. Deliberately import-free:
// the countdown math is the part most worth testing and the part most easily
// broken, and keeping it free of React, Supabase, and platform modules means it
// tests with no mocking at all.

/** A focus block's lifecycle state — mirrors the `focus_block_status` enum. */
export type TFocusBlockStatus = "active" | "paused" | "complete" | "cancelled";

/** How long a block runs when the user has expressed no preference. Matches the
 * column default in `20260813201604_add_preferences_focus_block_minutes.sql`;
 * both must move together. */
export const DEFAULT_FOCUS_BLOCK_MINUTES = 25;

/**
 * The lengths offered in Settings → Tasks. Values are strings because
 * `PickerField<V extends string>` requires it; the call site reads them back
 * through `Number`.
 *
 * The range brackets the two intervals the method page recommends — 25 minutes
 * for administrative work, 50 for deep work — rather than trying to be
 * exhaustive. This is an app-owned list expected to move with taste, which is
 * why the column carries no CHECK constraint.
 */
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

/**
 * A stored preference narrowed to a length this build offers.
 *
 * A newer client (or a hand-edited row) can store a length this build doesn't
 * list, and the picker would then render with *nothing* selected — the same
 * footgun `resolveAlarmSound` exists for. Degrade to the default instead.
 */
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

/**
 * How much time is left on a block right now, in exact (fractional) seconds.
 *
 * **This is the anchor design.** `remainingSeconds` is a snapshot taken at the
 * last pause and `resumedAt` is when the current run began, so a running block's
 * true remaining time is the snapshot minus however long it has been running.
 * Nothing writes a countdown to the database — every client subtracts.
 *
 * `nowMs` is a parameter rather than a `Date.now()` call so this tests without
 * mocking a clock (the dependency-injection habit in `docs/testing.md`).
 */
export const liveRemainingSeconds = (
  block: TFocusAnchor,
  nowMs: number,
): number => {
  if (block.status === "paused") return Math.max(0, block.remainingSeconds);
  if (block.status !== "active" || !block.resumedAt) return 0;

  // Elapsed is clamped at zero, which matters for a `nowMs` that predates the
  // anchor. A countdown's clock only ticks while the block runs, so after a ten
  // minute pause the caller's last reading is ten minutes older than the fresh
  // `resumedAt` a resume writes — a negative elapsed there would *add* those ten
  // minutes to the remaining time and show the timer jumping up. Clamped, the
  // worst case is the pre-pause figure holding for one tick.
  const elapsedSeconds = Math.max(
    0,
    (nowMs - Date.parse(block.resumedAt)) / 1000,
  );
  return Math.max(0, block.remainingSeconds - elapsedSeconds);
};

/**
 * A remaining-seconds value as a countdown reads it: `"24:59"`, `"0:07"`,
 * `"60:00"`.
 *
 * Rounds **up**, so a 25-minute block reads `25:00` for its whole first second
 * rather than dropping to `24:59` immediately, and only reaches `0:00` when the
 * time is genuinely gone.
 *
 * Minutes keep counting past 60 instead of growing an hours field. An hour is
 * the longest block on offer, and a field that appears only at the top of the
 * range would change the glyph count — which matters in the tab-bar accessory,
 * where the countdown sits in a fixed-width capsule.
 */
export const formatCountdown = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};
