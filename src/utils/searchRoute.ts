import type { Href } from "expo-router";

import { TSearchResult } from "@/api/search";
import { hasPromptsFor, type TTemplatePrompt } from "@/utils/journalPrompts";
import { ritualRoute } from "@/utils/ritualRoute";
import type { TRitualMode } from "@/utils/ritualSteps";
// From the import-free leaf module rather than `utils/taskFilters`, which pulls
// in the whole task-filtering surface for one predicate.
import { isCompletionStatus } from "@/utils/taskStatus";
import { todayRoute } from "@/utils/todayRoute";

/**
 * Where a search result opens (DEX-47). Owns both whether a result is tappable
 * and where the tap goes, so the Search screen's guard and route can't disagree.
 */

/** What the answer depends on beyond the result itself. */
type TSearchRouteOptions = {
  /** `preferences.enableJournal`; see `canOpenSearchResult`. */
  enableJournal: boolean;
  /** `preferences.templatePrompts` — which ritual asks each question, and
   * whether either has any at all. */
  templatePrompts: TTemplatePrompt[];
};

/**
 * False when no surface can show the result: a completed, unscheduled task (the
 * backlog filters those out), or a journal with no step (off, or no prompts —
 * DEX-151). The result card itself stays useful either way.
 */
export const canOpenSearchResult = (
  result: TSearchResult,
  options: TSearchRouteOptions,
): boolean => {
  const { enableJournal } = options;
  if (result.kind === "journal") {
    return enableJournal && options.templatePrompts.length > 0;
  }
  return (
    result.kind !== "task" ||
    result.task.scheduledFor !== null ||
    !isCompletionStatus(result.task.status)
  );
};

/**
 * The ritual that still asks this question, else whichever has prompts. Read from
 * the template, so a prompt moved since the day was written opens the wrong one.
 */
const journalResultMode = (
  prompt: string,
  { templatePrompts }: TSearchRouteOptions,
): TRitualMode => {
  const asked = templatePrompts.find((entry) => entry.prompt === prompt);
  if (asked) return asked.period;
  return hasPromptsFor(templatePrompts, "am") ? "am" : "pm";
};

/**
 * An unscheduled task goes to the backlog carrying `query` so the drawer seeds
 * its search box; a journal entry *names* its ritual. `nonce` differs per tap.
 */
export const searchResultRoute = (
  result: TSearchResult,
  query: string,
  nonce: string,
  options: TSearchRouteOptions,
): Href | null => {
  if (!canOpenSearchResult(result, options)) return null;

  if (result.kind === "task") {
    return result.task.scheduledFor
      ? todayRoute({ date: result.task.scheduledFor, mode: "tasks", n: nonce })
      : todayRoute({ mode: "backlog", q: query, n: nonce });
  }

  if (result.kind === "journal") {
    return ritualRoute({
      date: result.date,
      mode: journalResultMode(result.prompt, options),
      step: "journal",
      n: nonce,
    });
  }

  return todayRoute({ date: result.date, mode: "notes", n: nonce });
};
