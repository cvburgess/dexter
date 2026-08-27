import { Cron } from "croner";

/**
 * Shared by BOTH the Expo app and the mcp-server edge function (DEX-21). Import
 * only `croner`: Deno requires `.ts` on relative imports, Metro/tsc forbid it.
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
 * The next date (YYYY-MM-DD) strictly after `referenceDate`, or `null` — even
 * on an invalid cron — so callers can treat "no next task" uniformly.
 */
export const getNextOccurrence = (
  schedule: string | null | undefined,
  referenceDate: string,
): string | null => {
  if (!schedule) return null;

  // One second past midnight excludes a match ON `referenceDate` whether or not
  // croner's `nextRun` is inclusive; every match is at midnight, so none skip.
  const from = new Date(`${referenceDate}T00:00:01Z`);
  if (Number.isNaN(from.getTime())) return null;

  try {
    // `utcOffset: 0`, not `timezone: "UTC"`: Hermes ships partial Intl, and a
    // named timezone routes through it and can throw on device.
    const next = new Cron(schedule, { utcOffset: 0 }).nextRun(from);
    return next ? next.toISOString().slice(0, 10) : null;
  } catch {
    return null;
  }
};

/**
 * Unlike `getNextOccurrence`, counts `today` itself: promoting a template to a
 * cadence that matches today should produce a task today.
 */
export const getFirstOccurrence = (
  schedule: string | null | undefined,
  today: string,
): string | null => {
  const dayBefore = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(dayBefore.getTime())) return null;

  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  return getNextOccurrence(schedule, dayBefore.toISOString().slice(0, 10));
};

/**
 * References `max(today, scheduledFor)` so a rescheduled task's cadence follows
 * its new date and a late completion never spawns a task dated in the past.
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
 * Falls back to daily for anything that doesn't map cleanly onto a frequency
 * preset (e.g. step/range fields from an MCP-created template).
 */
export const parseSchedule = (
  schedule: string | null | undefined,
): TRepeatSchedule => {
  if (!schedule) return { frequency: "daily" };

  const match = /^0 0 (\S+) (\S+) (\S+)$/.exec(schedule);
  if (!match) return { frequency: "daily" };

  const [, dayOfMonth, month, dayOfWeek] = match;

  // Each branch returns only on a clean match; anything that doesn't map onto a
  // preset falls through to the terminal daily default.
  if (dayOfWeek !== "*") {
    const weekdays = parseIntList(dayOfWeek)?.map((day) =>
      day === 7 ? 0 : day,
    );
    if (dayOfMonth === "*" && month === "*" && weekdays) {
      return { frequency: "weekly", weekdays };
    }
  } else if (month !== "*") {
    const dom = parseSingleInt(dayOfMonth);
    const mon = parseSingleInt(month);
    if (dom !== null && mon !== null) {
      return { frequency: "yearly", month: mon, dayOfMonth: dom };
    }
  } else if (dayOfMonth !== "*") {
    const dom = parseSingleInt(dayOfMonth);
    if (dom !== null) return { frequency: "monthly", dayOfMonth: dom };
  }

  return { frequency: "daily" };
};

/** A short human-readable summary of a schedule for list rows. */
export const describeSchedule = (
  schedule: string | null | undefined,
): string => {
  // Guarded ahead of `parseSchedule`, whose daily fallback would otherwise
  // describe a scheduleless task template as repeating every day (DEX-65).
  if (!schedule) return "Doesn't repeat";

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
