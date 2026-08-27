import { Temporal } from "@js-temporal/polyfill";

import { TTask } from "@/api/tasks";
import { GlassIconButton } from "@/components/GlassIconButton";
import type { TIconName } from "@/components/Icon.types";
import { formatWeekdayMonthDay } from "@/utils/formatPlainDate";

// Named for the intent, not the value written: `schedule` targets the day
// on screen, `defer` the day after it, `unschedule` clears the date.
export type TScheduleMode = "schedule" | "defer" | "unschedule";

// `unschedule` is a bare minus on both platforms — Ionicons has no clean
// equivalent to SF's calendar.badge.minus, so both agree on the plain glyph.
const MODE_ICON: Record<TScheduleMode, TIconName> = {
  schedule: { sf: "plus", ionicon: "add-outline" },
  defer: { sf: "arrow.right", ionicon: "arrow-forward" },
  unschedule: { sf: "minus", ionicon: "remove-outline" },
};

type TTaskScheduleButtonProps = {
  task: TTask;
  mode: TScheduleMode;
  /** The day the surface is showing — `schedule` targets it, `defer` the
   * day after it; `unschedule` ignores it. */
  date: Temporal.PlainDate;
  /** Must be `useScheduleChange`'s `changeSchedule`, never raw `updateTask` —
   * a raw write once left a backlog task's alarm on the day it came from (DEX-77). */
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

// The round button that moves a task on or off a day. Every label names the
// day rather than "today"/"tomorrow" — DayNav can page the ritual anywhere.
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
