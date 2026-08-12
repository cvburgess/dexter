import { Temporal } from "@js-temporal/polyfill";

import { TTask } from "@/api/tasks";
import { GlassIconButton } from "@/components/GlassIconButton";
import type { TIconName } from "@/components/Icon.types";
import { formatWeekdayMonthDay } from "@/utils/formatPlainDate";

/**
 * What a schedule button does to `scheduledFor`.
 *
 * Named for the *intent* rather than the value written, because two of the three
 * write a date and only the mode says which: `schedule` puts a task onto the day
 * the surface is showing, `defer` onto the day after it, `unschedule` takes it
 * off the calendar entirely.
 */
export type TScheduleMode = "schedule" | "defer" | "unschedule";

/**
 * Every mode's glyph, on both icon sets.
 *
 * `unschedule` is a bare minus on iOS too, though SF Symbols has
 * `calendar.badge.minus` and Ionicons has no equivalent: the closest Ionicon,
 * `calendar-clear-outline`, is a calendar with an *x*, which reads as delete
 * rather than as taking the task off the day. Both platforms saying the same
 * plain minus beats one of them saying it better.
 *
 * `defer`'s arrow is also `StatusButton`'s glyph for DELEGATED — harmless, since
 * delegated is a terminal status and a task at one never appears beside these
 * buttons.
 */
const MODE_ICON: Record<TScheduleMode, TIconName> = {
  schedule: { sf: "plus", ionicon: "add-outline" },
  defer: { sf: "arrow.right", ionicon: "arrow-forward" },
  unschedule: { sf: "minus", ionicon: "remove-outline" },
};

type TTaskScheduleButtonProps = {
  task: TTask;
  mode: TScheduleMode;
  /**
   * The day the surface is showing. `schedule` targets it and `defer` the day
   * after it; `unschedule` still needs it for neither, and ignores it.
   */
  date: Temporal.PlainDate;
  /**
   * **Must be a `useScheduleChange` `changeSchedule`, never a raw `updateTask`.**
   * An alarm is bound to its task's scheduled date, so every write here owes the
   * prompt that hook gives — writing straight through is what once left a
   * backlog task's alarm pointing at the day it came from (DEX-77).
   *
   * Taken as a prop rather than by calling the hook here: it returns the props
   * for one `ConfirmationModal`, and a button that owned that would mount a
   * modal per row. The hook belongs to the surface; this belongs to the row.
   */
  onChangeSchedule: (task: TTask, scheduledFor: string | null) => void;
  /** Passed through for a button under a ritual step's fade — see `GlassIconButton`. */
  solid?: boolean;
};

/** The day each mode writes, or `null` for the one that clears the date. */
const targetFor = (
  mode: TScheduleMode,
  date: Temporal.PlainDate,
): string | null => {
  if (mode === "unschedule") return null;
  return (mode === "defer" ? date.add({ days: 1 }) : date).toString();
};

/**
 * The round button beside a task row that moves it on or off a day.
 *
 * Three surfaces draw one — the backlog drawer's "+", and the evening ritual's
 * Open tasks step at both ends of its rows — and all three were the same
 * `GlassIconButton` over the same `changeSchedule` call, retyping the same
 * label convention. The convention is the part worth holding in one place:
 * **every label names the day rather than saying "today" or "tomorrow"**, since
 * the drawer sits beside seven days on the Week tab and `DayNav` can page the
 * ritual anywhere, so a relative word would be a button that lies about where a
 * task went.
 */
export function TaskScheduleButton({
  task,
  mode,
  date,
  onChangeSchedule,
  solid,
}: TTaskScheduleButtonProps) {
  const target = targetFor(mode, date);
  const label =
    target === null
      ? `Unschedule "${task.title}"`
      : `${mode === "defer" ? "Move" : "Schedule"} "${task.title}" ${
          mode === "defer" ? "to" : "for"
        } ${formatWeekdayMonthDay(Temporal.PlainDate.from(target))}`;

  return (
    <GlassIconButton
      accessibilityLabel={label}
      ionicon={MODE_ICON[mode].ionicon}
      onPress={() => onChangeSchedule(task, target)}
      sfSymbol={MODE_ICON[mode].sf}
      solid={solid}
    />
  );
}
