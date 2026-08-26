import type { Href } from "expo-router";

import { TSearchResult } from "@/api/search";
import { hasPromptsFor } from "@/utils/journalPrompts";
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
  /** The morning ritual's prompts (`preferences.templatePrompts`). */
  templatePrompts: string[];
  /** The evening ritual's (`preferences.templatePromptsPm`). */
  templatePromptsPm: string[];
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
 * Since DEX-151 the preference is not the whole of it: a journal with prompts in
 * *neither* ritual has no step in either, so it is the same dead end. Prompts in
 * only one is fine — the link names that ritual rather than letting the clock
 * choose (see `searchResultRoute`).
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
    return (
      enableJournal &&
      (hasPromptsFor(options, "am") || hasPromptsFor(options, "pm"))
    );
  }
  return (
    result.kind !== "task" ||
    result.task.scheduledFor !== null ||
    !isCompletionStatus(result.task.status)
  );
};

/**
 * The ritual to open a journal hit in: the one that still asks that question.
 *
 * Falls back to whichever ritual has prompts at all — the prompt may have been
 * renamed or deleted since the day was written, and the entry is still worth
 * opening. The morning wins a tie, matching the order the day runs and the
 * period every prompt predating the split has.
 *
 * `canOpenSearchResult` has already refused the case where neither has any, so
 * the fallback is never a ritual without a Journal step.
 *
 * **Read from the template, where `JournalView` filters the day by the period
 * stored on the entry itself.** The two agree for every day seeded since the
 * prompt last moved, and disagree for older ones: move a prompt to the evening
 * and a morning entry written before that still belongs to the morning, so this
 * link opens the evening ritual and the entry is not among its fields. The
 * empty state names that case, and the entry is one AM/PM tap away. Closing the
 * gap properly means `search_entries` returning each entry's `period`, which is
 * an RPC change this doesn't need — the alternative, letting the clock choose,
 * is wrong far more often.
 */
const journalResultMode = (
  prompt: string,
  { templatePrompts, templatePromptsPm }: TSearchRouteOptions,
): TRitualMode => {
  if (templatePrompts.includes(prompt)) return "am";
  if (templatePromptsPm.includes(prompt)) return "pm";
  return templatePrompts.length > 0 ? "am" : "pm";
};

/**
 * Where tapping a search result should land, or null when it has nowhere to go
 * (see `canOpenSearchResult`).
 *
 * An *incomplete* task with no scheduled date goes to the backlog with the query
 * carried along — the drawer seeds its own search box from it, so the task is on
 * screen immediately instead of somewhere in the backlog. A journal entry goes
 * to its day's journal step in the Ritual tab, **naming the ritual** rather than
 * letting the clock pick it (DEX-151): now that each ritual asks only its own
 * prompts, the flow the clock lands on may have no journal step at all, and the
 * tap would arrive at whatever step happens to be first.
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
