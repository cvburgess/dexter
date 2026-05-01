import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Expected date in YYYY-MM-DD format",
);
export const taskPrioritySchema = z.number().int().min(0).max(4);
export const taskStatusSchema = z.number().int().min(0).max(3);
export const themeModeSchema = z.number().int().min(0).max(2);

export const cronScheduleRegex =
  /^0 0 (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*) (\*|([1-9]|1[0-2])|\*\/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*) (\*|([0-7])|\*\/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*)$/;

export const cronScheduleSchema = z.string().regex(
  cronScheduleRegex,
  "Schedule must be a midnight cron expression: 0 0 <day-of-month> <month> <day-of-week>",
);

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function toolJson(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function toolError(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function compactUpdate(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

export function hasUpdates(fields: Record<string, unknown>): boolean {
  return Object.keys(fields).length > 0;
}

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
