import type { TRitualMode } from "@/utils/ritualSteps";

/**
 * The journal's prompt template: which ritual asks each question (DEX-151).
 *
 * `preferences.templatePrompts` is a jsonb array of `{id, prompt, period}`. A
 * prompt belongs to the morning **or** the evening, never both, and the period
 * is a field on the prompt rather than "which of two columns holds it" — so
 * moving one is a single edit that cannot half-apply, the list keeps one order
 * across both rituals, and there is somewhere to put an id.
 *
 * The same shape `journals.prompts` already had, which is the point: a day's
 * answers and the template they seed from now differ only in that a day's entry
 * carries a `response`.
 *
 * React-free and Supabase-free, the discipline `utils/ritualSteps.ts` spells
 * out — `ritual/index.tsx` reads `hasPromptsFor` to decide whether the Journal
 * step exists at all, and dragging the Supabase client into that leaf's module
 * graph is the thing that rule exists to prevent.
 *
 * A prompt's period is typed `TRitualMode` rather than getting a parallel
 * two-value union of its own. It is not merely the same shape as the ritual
 * mode, it *is* the ritual mode: the period answers "which ritual asks this
 * question", and a second type would only give the two a way to drift.
 */
export type TTemplatePrompt = {
  /**
   * Unique within one user's list, not across users — an array key, the same
   * contract `tasks.subtasks` states. Stable across edits, so renaming a prompt
   * stays a rename rather than reading as delete-plus-add.
   */
  id: string;
  prompt: string;
  period: TRitualMode;
};

let counter = 0;

/**
 * Mints a prompt id.
 *
 * **A deliberate copy of `makeSubtaskId`, not a shared helper.** The obvious
 * move is to lift the generator into a leaf both import, and it does not work:
 * `utils/subtasks.ts` is loaded by the Deno MCP server through `@src/`, and
 * Deno requires a `.ts` extension on an import that Metro and tsc forbid — the
 * same reason that file cannot import `utils/taskStatus.ts` either, spelled out
 * in its own docstring. Sharing this would break `deno check`. Eight lines is
 * the cheaper price.
 */
const makeTemplatePromptId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;

  counter += 1;
  const random = Math.random().toString(36).slice(2, 10);
  return `jp_${Date.now().toString(36)}_${counter.toString(36)}_${random}`;
};

/**
 * A blank prompt for the settings editor's "+".
 *
 * Morning by default — the period every prompt that predates this feature has,
 * and adding a question shouldn't quietly open a second journal in a ritual the
 * user may not journal in.
 */
export const newTemplatePrompt = (
  period: TRitualMode = "am",
): TTemplatePrompt => ({ id: makeTemplatePromptId(), prompt: "", period });

/**
 * Reads the stored column into the shape the app uses.
 *
 * **jsonb guarantees an array and nothing else** — the CHECK constraint tests
 * `jsonb_typeof`, not the shape of the elements, exactly as `journals.prompts`
 * does. So every field is coerced rather than trusted: this is the one place
 * that has to hold, since callers `.map()` the result and read `.period` off
 * each entry. The same job `rowToJournal` does for the sibling column.
 *
 * A missing id falls back to the element's position rather than a fresh mint:
 * an id that changed on every read would re-key the settings list on every
 * render. Post-migration every stored prompt has one, so this only catches a
 * row written by something that skipped the app.
 */
export const parseTemplatePrompts = (value: unknown): TTemplatePrompt[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry, index) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { id, prompt, period } = entry as Record<string, unknown>;
    return [
      {
        id: typeof id === "string" && id ? id : `i${index}`,
        prompt: typeof prompt === "string" ? prompt : "",
        period: period === "pm" ? "pm" : "am",
      },
    ];
  });
};

/** The prompts one ritual asks, in the order the user arranged them. */
export const promptsFor = (
  prompts: readonly TTemplatePrompt[],
  mode: TRitualMode,
): TTemplatePrompt[] => prompts.filter((entry) => entry.period === mode);

/**
 * Whether a ritual has any journal prompts of its own — the input that decides
 * whether its Journal step exists (see `ritual/index.tsx`).
 *
 * Counts blank prompts, deliberately. A prompt added but not yet typed is still
 * a prompt the user asked for, and the morning list has always rendered one as
 * an unlabelled field; excluding it here would make the step flicker out of the
 * ritual between the tap that adds it and the first keystroke.
 */
export const hasPromptsFor = (
  prompts: readonly TTemplatePrompt[],
  mode: TRitualMode,
): boolean => prompts.some((entry) => entry.period === mode);

/**
 * The period of a stored **journal entry**, defaulting to morning.
 *
 * The single place the legacy-row fallback lives. Every `journals.prompts`
 * entry written before DEX-151 carries no `period`, and so does anything an
 * older build writes today — both must read as morning, matching what the
 * migration does to the prompts they were seeded from. Anything that is not the
 * literal `"pm"` falls back rather than being trusted, since that column is
 * jsonb and carries no shape check either.
 */
export const promptPeriod = (entry: {
  period?: TRitualMode | null;
}): TRitualMode => (entry.period === "pm" ? "pm" : "am");
