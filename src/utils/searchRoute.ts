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
 * Where a search result opens (DEX-47).
 *
 * Split out of `utils/todayRoute.ts` once a result could land somewhere other
 * than the Today tab: since DEX-105 a journal result opens the **Ritual** tab,
 * so "the Today tab's deep-link contract" no longer described this pair. It
 * owns both halves — whether a result is tappable at all, and where the tap
 * goes — so the Search screen's `onPress` guard and the route it would build
 * can't disagree.
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
 * Whether a search result has anywhere to open.
 *
 * False in two cases. A **completed** task with no scheduled date has no day to
 * open, and the backlog — where an unscheduled task would otherwise go — can
 * never show it: `selectBacklogTasks` filters to incomplete tasks before any
 * preset runs, and the canonical `["tasks"]` fetch excludes completed rows with
 * a null `scheduledFor` outright. Linking it would open an empty drawer reading
 * "you're all caught up", which is a dead end rather than an answer.
 *
 * A **journal** result with the journal disabled is the same shape of dead end:
 * the ritual has no journal step for that user (see `stepsFor`), so the link
 * would switch tabs and land on whatever step happens to be first. Old entries
 * stay searchable and readable either way — only the tap target goes.
 *
 * Since DEX-151 a journal with no prompts has no step in either ritual, which is
 * the same dead end; prompts in only one is fine, since the link names it.
 *
 * Nothing is lost by not linking either: the result card in Search *is* the
 * useful surface, and `TaskCard` renders its `StatusButton` above the
 * `isComplete` guard, so a task can still be reopened from the results.
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
 * Where tapping a search result should land, or null when it has nowhere to go
 * (see `canOpenSearchResult`).
 *
 * An *incomplete* task with no scheduled date goes to the backlog with the query
 * carried along — the drawer seeds its own search box from it, so the task is on
 * screen immediately instead of somewhere in the backlog. A journal entry goes to
 * its day's journal step, **naming the ritual** — the clock's may not have one.
 *
 * `nonce` should differ per tap; see `TTodayRouteParams["n"]`.
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
