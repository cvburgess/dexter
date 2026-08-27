import { z } from "zod";

import { Constants } from "@src/types/database.types.ts";
import { normalizeTaskUrl } from "@src/utils/taskUrl.ts";
import { ETaskPriority } from "@src/utils/taskPriority.ts";
import { ETaskStatus, isCompletionStatus } from "@src/utils/taskStatus.ts";

import { captureException } from "../../_shared/sentry.ts";

export const uuidSchema = z.string().uuid();
export const dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Expected date in YYYY-MM-DD format",
);
/**
 * Declared once because `list_tasks`'s filter unions restate them — a `z.union`
 * emits its own description, not its members'.
 */
export const PRIORITY_VALUES =
  "0 = Important & Urgent, 1 = Urgent, 2 = Important, " +
  "3 = Neither (explicitly deprioritized), 4 = Unprioritized (never set)";

export const STATUS_VALUES =
  "0 = In Progress, 1 = To Do, 2 = Done, 3 = Won't Do, 4 = Delegated";

/**
 * Input-only, derived from the app's enums — the columns are unconstrained
 * smallints, so these schemas are the only rejection; descriptions are the
 * DEX-137 fix, not decoration.
 */
export const taskPrioritySchema = z.nativeEnum(ETaskPriority).describe(
  `Eisenhower-matrix priority. ${PRIORITY_VALUES}. 4 is the default for a new ` +
    "task. Lower is more urgent. Note 4 means 'no priority chosen', not " +
    "'lowest priority'. This is NOT the same numbering as `status` — 1 here " +
    "is Urgent, not To Do.",
);

export const taskStatusSchema = z.nativeEnum(ETaskStatus).describe(
  `Task status. ${STATUS_VALUES}. 1 is the default for a new task. 0 and 1 ` +
    "are open; 2, 3 and 4 are terminal. This is NOT the same numbering as " +
    "`priority` — 1 here is To Do, not Urgent.",
);
export const themeModeSchema = z.number().int().min(0).max(2);
/**
 * DEX-128: built from the generated enum array so a label Postgres would
 * reject can't be accepted here.
 */
export const sunSignSchema = z.enum(Constants.public.Enums.sun_sign);

/**
 * DEX-66: transforms via the app's `normalizeTaskUrl` rather than validating —
 * rejecting would fail a call over an optional field the form itself accepts.
 */
export const taskUrlSchema = z.string().max(2048).transform(normalizeTaskUrl);

// DEX-70: bounds declared once for the tasks and templates tools — a runaway
// client must not write a multi-megabyte jsonb array into a row.
const subtaskIdSchema = z.string().min(1).max(64);
const subtaskTitleSchema = z.string().min(1).max(100);
const MAX_SUBTASKS = 100;

/**
 * DEX-153: `done` defaults false so bare titles compose. `.strict()` because Zod
 * strips unknown keys — a legacy `status: 2` would silently write a not-done item.
 */
export const subtaskSchema = z.object({
  id: subtaskIdSchema,
  title: subtaskTitleSchema,
  done: z.boolean().default(false),
}).strict();

export const subtasksSchema = z.array(subtaskSchema).max(MAX_SUBTASKS);

/**
 * Read-side: deliberately unbounded, and coerces legacy `status` (which outranks
 * a stale `done` beside it) — a failed parse means "no subtasks" and silently
 * skips the completion sweep (DEX-153).
 */
export const storedSubtasksSchema = z.array(
  z.object({
    id: z.string().min(1),
    title: z.string(),
    done: z.boolean().optional(),
    // Not `taskStatusSchema`: legacy debris being read, so `.catch` keeps even
    // an out-of-enum value from failing the item and skipping the sweep.
    status: z.number().optional().catch(undefined),
  }).transform(({ id, title, done, status }) => ({
    id,
    title,
    done: status === undefined ? done ?? false : isCompletionStatus(status),
  })),
);

export const storedTemplateSubtasksSchema = z.array(
  z.object({ id: z.string().min(1), title: z.string() }),
);

/**
 * Deliberately narrower — no status: a template is a blueprint, and each
 * occurrence materializes its own copy at the open status.
 */
export const templateSubtaskSchema = z.object({
  id: subtaskIdSchema,
  title: subtaskTitleSchema,
});

export const templateSubtasksSchema = z
  .array(templateSubtaskSchema)
  .max(MAX_SUBTASKS);

export const cronScheduleRegex = /^0 0 (\S+) (\S+) (\S+)$/;

export const cronScheduleSchema = z.string()
  .regex(
    cronScheduleRegex,
    "Schedule must be a midnight cron expression: 0 0 <day-of-month> <month> <day-of-week>",
  )
  .refine(isValidCronSchedule, {
    message:
      "Schedule fields must use *, */n, n, n-m, or n,n values within valid day/month ranges",
  });

function isValidCronSchedule(schedule: string): boolean {
  const match = cronScheduleRegex.exec(schedule);
  if (!match) return false;

  const [, dayOfMonth, month, dayOfWeek] = match;
  return (
    isValidCronField(dayOfMonth, 1, 31) &&
    isValidCronField(month, 1, 12) &&
    isValidCronField(dayOfWeek, 0, 7)
  );
}

function isValidCronField(field: string, min: number, max: number): boolean {
  if (field === "*") return true;

  if (field.startsWith("*/")) {
    return isIntegerInRange(field.slice(2), 1, max);
  }

  if (field.includes(",")) {
    return field.split(",").every((value) => isIntegerInRange(value, min, max));
  }

  if (field.includes("-")) {
    const [start, end, ...extra] = field.split("-");
    if (extra.length > 0) return false;
    if (
      !isIntegerInRange(start, min, max) || !isIntegerInRange(end, min, max)
    ) {
      return false;
    }

    return Number(start) <= Number(end);
  }

  return isIntegerInRange(field, min, max);
}

function isIntegerInRange(value: string, min: number, max: number): boolean {
  if (!/^\d+$/.test(value)) return false;

  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max;
}

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function toolJson(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function toolError(message: string): ToolResult {
  captureException(new Error(message));
  return { content: [{ type: "text", text: message }], isError: true };
}

export function compactUpdate<T extends Record<string, unknown>>(
  fields: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export function hasUpdates(fields: Record<string, unknown>): boolean {
  return Object.keys(fields).length > 0;
}

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
