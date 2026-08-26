import type { TRitualMode } from "@/utils/ritualSteps";

/**
 * The journal's prompt template, split across the two rituals (DEX-151).
 *
 * Prompts used to be one list that both rituals showed, so the same questions
 * opened and closed the day. They are now two: `preferences.templatePrompts` is
 * the morning list and `preferences.templatePromptsPm` the evening one.
 *
 * **A prompt belongs to exactly one of them — there is no "both".** That is
 * what lets the period be a property of *which array holds the prompt* rather
 * than a value stored beside it, and it is why the migration backfills nothing:
 * every prompt that existed before this feature is already in the array that
 * now means morning.
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
  prompt: string;
  period: TRitualMode;
};

/**
 * The pair of stored columns, as an object rather than two arguments.
 *
 * Both are `string[]`, so positional parameters would let a transposed pair
 * through as a silent bug rather than a compile error — the same call
 * `createRitualState` makes about its toggles. It also means `TPreferences`
 * satisfies this structurally, so every call site passes `preferences` itself
 * and there is nothing to transpose.
 */
export type TTemplatePromptColumns = {
  templatePrompts: readonly string[];
  templatePromptsPm: readonly string[];
};

/**
 * The two stored arrays as the one list the settings editor edits, morning
 * first.
 *
 * Order within a period is the stored order; there is no order *across* them to
 * preserve, which is the one thing two columns cannot carry and a single
 * `{prompt, period}` column could. The visible consequence is that changing a
 * row's period moves it into that period's group — the row travelling to where
 * it now belongs, rather than a list that silently reorders.
 */
export const mergeTemplatePrompts = ({
  templatePrompts,
  templatePromptsPm,
}: TTemplatePromptColumns): TTemplatePrompt[] => [
  ...templatePrompts.map((prompt) => ({ prompt, period: "am" as const })),
  ...templatePromptsPm.map((prompt) => ({ prompt, period: "pm" as const })),
];

/**
 * `mergeTemplatePrompts` inverted: the editor's list back into the two columns,
 * shaped to spread straight into `updatePreferences`.
 *
 * Both arrays are always returned, so a period change writes the prompt's
 * departure and its arrival in **one** update. Writing only the array that
 * gained it would leave the prompt in both, which is the one state this model
 * has no way to mean.
 */
export const splitTemplatePrompts = (
  prompts: readonly TTemplatePrompt[],
): { templatePrompts: string[]; templatePromptsPm: string[] } => ({
  templatePrompts: prompts
    .filter((entry) => entry.period === "am")
    .map((entry) => entry.prompt),
  templatePromptsPm: prompts
    .filter((entry) => entry.period === "pm")
    .map((entry) => entry.prompt),
});

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
  { templatePrompts, templatePromptsPm }: TTemplatePromptColumns,
  mode: TRitualMode,
): boolean => (mode === "pm" ? templatePromptsPm : templatePrompts).length > 0;

/**
 * The period of a stored journal entry, defaulting to morning.
 *
 * The single place the legacy-row fallback lives. Every `journals.prompts` entry
 * written before DEX-151 carries no `period`, and so does anything an older
 * build of the app writes today — both must read as morning, matching the
 * migration's treatment of the prompts they were seeded from. Anything that is
 * not the literal `"pm"` falls back rather than being trusted, since the column
 * is jsonb and carries no CHECK.
 */
export const promptPeriod = (entry: {
  period?: TRitualMode | null;
}): TRitualMode => (entry.period === "pm" ? "pm" : "am");
