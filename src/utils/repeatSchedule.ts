import { Cron } from "croner";

/**
 * Shared repeat-schedule logic for repeat task templates, used by BOTH the Expo
 * app (`@/utils/repeatSchedule`) and the mcp-server edge function
 * (`@src/utils/repeatSchedule.ts`). It replaces the legacy Postgres
 * `create_next_recurring_task` trigger (see the DEX-21 migration).
 *
 * Keep this file self-contained: import only `croner`. Deno requires explicit
 * `.ts` extensions on relative imports while Metro/tsc forbid them, so pulling
 * in another `src/` module here would break one of the two runtimes.
 *
 * Schedules are midnight cron expressions (`0 0 <day-of-month> <month>
 * <day-of-week>`), matching the `repeat_task_templates.schedule` RLS
 * constraint. All date math is done in UTC over calendar dates (no time of day),
 * so it never drifts with the device's timezone.
 */

/** Cron day-of-week is 0-6 with 0 = Sunday (7 is also accepted as Sunday). */
export type TRepeatFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type TRepeatSchedule =
  | { frequency: "daily" }
  | { frequency: "weekly"; weekdays: number[] }
  | { frequency: "monthly"; dayOfMonth: number }
  | { frequency: "yearly"; month: number; dayOfMonth: number };

const DAILY_SCHEDULE = "0 0 * * *";

// Indexed by cron day-of-week (0 = Sunday).
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Indexed by (month - 1).
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * The next date (YYYY-MM-DD) a `schedule` fires strictly after `referenceDate`,
 * or `null` when there is no schedule or the pattern has no upcoming match
 * (e.g. an impossible calendar date). Returns `null` on an invalid cron rather
 * than throwing so callers can treat "no next task" uniformly.
 */
export const getNextOccurrence = (
  schedule: string | null | undefined,
  referenceDate: string,
): string | null => {
  if (!schedule) return null;

  // Start one second past midnight so a match ON `referenceDate` is excluded
  // regardless of whether croner treats `nextRun` as inclusive — every match is
  // at midnight, so the offset can never skip a valid occurrence.
  const from = new Date(`${referenceDate}T00:00:01Z`);
  if (Number.isNaN(from.getTime())) return null;

  try {
    const next = new Cron(schedule, { timezone: "UTC" }).nextRun(from);
    return next ? next.toISOString().slice(0, 10) : null;
  } catch {
    return null;
  }
};

/**
 * The date (YYYY-MM-DD) to schedule the next occurrence of a completed repeat
 * task, or `null` when it should not recur. The reference point is
 * `max(today, scheduledFor)` so a rescheduled task's cadence follows its new
 * date and a late completion never spawns a task dated in the past.
 */
export const getNextTaskDate = (
  task: { scheduledFor: string | null },
  schedule: string | null | undefined,
  today: string,
): string | null => {
  const reference = maxDate(today, task.scheduledFor);
  return getNextOccurrence(schedule, reference);
};

// ISO YYYY-MM-DD strings compare correctly with lexical `>`.
const maxDate = (a: string, b: string | null): string => {
  if (!b) return a;
  return a >= b ? a : b;
};

/** Builds a midnight cron expression from an editor-friendly schedule. */
export const buildSchedule = (schedule: TRepeatSchedule): string => {
  switch (schedule.frequency) {
    case "daily":
      return DAILY_SCHEDULE;
    case "weekly": {
      const days = [...new Set(schedule.weekdays)].sort((a, b) => a - b);
      return `0 0 * * ${days.length > 0 ? days.join(",") : "*"}`;
    }
    case "monthly":
      return `0 0 ${schedule.dayOfMonth} * *`;
    case "yearly":
      return `0 0 ${schedule.dayOfMonth} ${schedule.month} *`;
  }
};

/**
 * Parses a midnight cron expression back into an editor-friendly schedule.
 * Falls back to a daily schedule for anything that doesn't map cleanly onto a
 * frequency preset (e.g. step/range fields from an MCP-created template).
 */
export const parseSchedule = (
  schedule: string | null | undefined,
): TRepeatSchedule => {
  if (!schedule) return { frequency: "daily" };

  const match = /^0 0 (\S+) (\S+) (\S+)$/.exec(schedule);
  if (!match) return { frequency: "daily" };

  const [, dayOfMonth, month, dayOfWeek] = match;

  if (dayOfWeek !== "*") {
    const weekdays = parseIntList(dayOfWeek)?.map((day) =>
      day === 7 ? 0 : day,
    );
    if (dayOfMonth === "*" && month === "*" && weekdays) {
      return { frequency: "weekly", weekdays };
    }
    return { frequency: "daily" };
  }

  if (month !== "*") {
    const dom = parseSingleInt(dayOfMonth);
    const mon = parseSingleInt(month);
    if (dom !== null && mon !== null) {
      return { frequency: "yearly", month: mon, dayOfMonth: dom };
    }
    return { frequency: "daily" };
  }

  if (dayOfMonth !== "*") {
    const dom = parseSingleInt(dayOfMonth);
    if (dom !== null) return { frequency: "monthly", dayOfMonth: dom };
    return { frequency: "daily" };
  }

  return { frequency: "daily" };
};

/** A short human-readable summary of a schedule for list rows. */
export const describeSchedule = (
  schedule: string | null | undefined,
): string => {
  const parsed = parseSchedule(schedule);

  switch (parsed.frequency) {
    case "daily":
      return "Every day";
    case "weekly": {
      const days = [...parsed.weekdays]
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_NAMES[day] ?? "")
        .filter(Boolean);
      return days.length > 0 ? `Weekly on ${days.join(", ")}` : "Weekly";
    }
    case "monthly":
      return `Monthly on the ${ordinal(parsed.dayOfMonth)}`;
    case "yearly":
      return `Yearly on ${MONTH_NAMES[parsed.month - 1] ?? ""} ${parsed.dayOfMonth}`.trim();
  }
};

const parseIntList = (field: string): number[] | null => {
  const parts = field.split(",");
  const values: number[] = [];
  for (const part of parts) {
    const value = parseSingleInt(part);
    if (value === null) return null;
    values.push(value);
  }
  return values;
};

const parseSingleInt = (value: string): number | null => {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
};

const ordinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
};
