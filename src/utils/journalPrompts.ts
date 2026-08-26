import type { TRitualMode } from "@/utils/ritualSteps";

/**
 * The journal's prompt template (DEX-151): a jsonb array of `{id, prompt, period}`,
 * the same shape `journals.prompts` has. React- and Supabase-free, like `ritualSteps`.
 */
export type TTemplatePrompt = {
  /** Unique within one user's list, not across users — an array key, like `subtasks`. */
  id: string;
  prompt: string;
  period: TRitualMode;
};

let counter = 0;

/**
 * A deliberate copy of `makeSubtaskId`: `utils/subtasks.ts` is loaded by Deno through
 * `@src/`, which needs a `.ts` extension on imports that Metro and tsc forbid.
 */
const makeTemplatePromptId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;

  counter += 1;
  const random = Math.random().toString(36).slice(2, 10);
  return `jp_${Date.now().toString(36)}_${counter.toString(36)}_${random}`;
};

/** A blank prompt for the settings editor's "+", morning by default. */
export const newTemplatePrompt = (
  period: TRitualMode = "am",
): TTemplatePrompt => ({ id: makeTemplatePromptId(), prompt: "", period });

/**
 * The only way to read the column: jsonb guarantees nothing about its elements, so
 * every field is coerced. A missing id falls back to position, not a fresh mint.
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

/**
 * Whether a ritual has a Journal step at all (see `ritual/index.tsx`). Counts blank
 * prompts, so the step doesn't flicker between the tap that adds one and the typing.
 */
export const hasPromptsFor = (
  prompts: readonly TTemplatePrompt[],
  mode: TRitualMode,
): boolean => prompts.some((entry) => entry.period === mode);

/**
 * The period of a stored **journal entry**, and the one place the fallback lives:
 * anything but `"pm"` reads as morning, including entries written before DEX-151.
 */
export const promptPeriod = (entry: {
  period?: TRitualMode | null;
}): TRitualMode => (entry.period === "pm" ? "pm" : "am");
