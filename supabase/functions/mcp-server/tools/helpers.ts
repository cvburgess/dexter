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
 * The value tables the descriptions below are built from, declared once because
 * `list_tasks`'s filters restate them too — a `z.union` emits its own description
 * rather than its members'. A sixth priority or status then changes one string,
 * not four.
 */
export const PRIORITY_VALUES =
  "0 = Important & Urgent, 1 = Urgent, 2 = Important, " +
  "3 = Neither (explicitly deprioritized), 4 = Unprioritized (never set)";

export const STATUS_VALUES =
  "0 = In Progress, 1 = To Do, 2 = Done, 3 = Won't Do, 4 = Delegated";

/**
 * Both derived from the app's enums rather than hand-written numeric bounds, so
 * neither can fall behind a newly added member. That drift matters: `priority`
 * and `status` are unconstrained smallints with no check constraint, making these
 * schemas the only thing that rejects a bogus value.
 *
 * Both are input-only. `storedSubtasksSchema` deliberately does *not* reuse
 * `taskStatusSchema` for the legacy status it reads, because there a parse
 * failure is read as "no subtasks" and silently skips a task's completion sweep.
 *
 * The descriptions are load-bearing, not decoration (DEX-137). The two fields sit
 * adjacent in the same tool input as bare `0–4` integers meaning entirely
 * different things, so each names every value and contrasts the other field's
 * numbering. Prefer this over folding field semantics into tool-level prose.
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
 * A sun sign (DEX-128), built from the generated runtime enum array rather than
 * a hand-written list, for the same reason `taskStatusSchema` derives from the
 * app's enum: a thirteenth label would otherwise be accepted here and rejected
 * by Postgres. `preferences.sun_sign` is a real enum column, so a bad value is
 * a failed update rather than a silently stored string.
 */
export const sunSignSchema = z.enum(Constants.public.Enums.sun_sign);

/**
 * A task's link (DEX-66). Transforms rather than validates, reusing the app's
 * own `normalizeTaskUrl` so an agent-supplied link is stored exactly like a
 * typed one: trimmed, `null` when blank, and given an `https://` when it is a
 * bare host. Rejecting here would be stricter than the form the same column is
 * written from, and would fail a call over a field the task doesn't need.
 */
export const taskUrlSchema = z.string().max(2048).transform(normalizeTaskUrl);

// Subtasks (DEX-70) live as a jsonb array on the parent row. Ids are minted by
// the client and only have to be unique within their own array. The bounds are
// declared once here — both the tasks and templates tools use them, and a
// runaway client must not be able to write a multi-megabyte array into a row.
const subtaskIdSchema = z.string().min(1).max(64);
const subtaskTitleSchema = z.string().min(1).max(100);
const MAX_SUBTASKS = 100;

/**
 * A task's checklist item: complete or incomplete, nothing else (DEX-153).
 * `done` defaults to `false` so an agent composing a checklist can send bare
 * titles — the overwhelmingly common case — without restating it per item.
 *
 * `.strict()` so the break from the old `{id, title, status}` shape fails loudly.
 * Zod strips unknown keys by default, which would take a legacy `status: 2` and
 * write a *not*-done item — silently unchecking a completed subtask. An agent
 * calling with the old shape needs an error it can read, not a quiet downgrade.
 */
export const subtaskSchema = z.object({
  id: subtaskIdSchema,
  title: subtaskTitleSchema,
  done: z.boolean().default(false),
}).strict();

export const subtasksSchema = z.array(subtaskSchema).max(MAX_SUBTASKS);

/**
 * Schemas for *reading* what is already stored, as opposed to validating tool
 * input. Deliberately unbounded: the write bounds are a policy on new input,
 * and applying them to a read makes an over-long row unparseable — which, since
 * a failed parse means "no subtasks", would silently skip that task's
 * completion sweep instead of rejecting anything.
 *
 * For the same reason this accepts a legacy `status` item and coerces it
 * (DEX-153) rather than rejecting it. The backfill migration converts what is
 * stored, but an app bundle predating the change keeps writing `status` until
 * its user updates, and refusing those rows would disable the sweep on exactly
 * the tasks still being edited from an old client.
 *
 * A `status` present at all wins over a `done` beside it. Nothing written since
 * DEX-153 emits one, so its presence identifies a pre-DEX-153 writer — and those
 * clients spread the item they read, so post-backfill they send a fresh `status`
 * alongside the stale `done` they never touched.
 */
export const storedSubtasksSchema = z.array(
  z.object({
    id: z.string().min(1),
    title: z.string(),
    done: z.boolean().optional(),
    // Not `taskStatusSchema`: this is legacy debris being read, not a value
    // being accepted, so bounding it can only *lose* data. An out-of-enum
    // stored status would fail the item, and a failed parse means "no
    // subtasks" — the silent-sweep-skip this file's read/write split exists to
    // avoid. `.catch` leaves the field unable to reject anything at all.
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
 * A template's checklist item. Deliberately narrower — no status, because a
 * template is a blueprint and each occurrence materializes its own copy at the
 * open status.
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
