// LLM summarization for DEX-84.
//
// Follows the Magic Meal Kit convention for AI SDK calls (see its commit
// fc837087, "Migrate AI SDK calls to Vercel AI Gateway"): a bare
// `provider/model` string rather than a constructed provider, structured output
// via `generateText` + `Output.object`, and AI_GATEWAY_API_KEY read implicitly
// by the SDK rather than through `Deno.env.get`. There is no gateway client to
// build and no key to validate here.

import { generateText, type LanguageModel, Output } from "ai";
import { z } from "zod";

import { PREDICTION_FACETS, type TPrediction } from "./astrology.ts";

/** Vercel AI Gateway model id. Cheap and fast; the output is two short fields. */
export const SUMMARY_MODEL: LanguageModel = "deepseek/deepseek-v4-flash-0731";

/**
 * Soft cap on `summary`, enforced in the prompt and truncated defensively
 * below.
 *
 * Deliberately not a `.max()` on the schema: a schema violation throws
 * `NoObjectGeneratedError` and loses the whole generation, whereas a summary
 * three characters over budget is worth keeping. The database agrees — the
 * column is `text`, not `varchar(100)` — because this number is expected to
 * move with prompt tuning.
 */
export const SUMMARY_MAX_LENGTH = 100;

/**
 * The `public.horoscope_sentiment` labels.
 *
 * Exported so the migration test can assert against this list rather than a
 * second copy of the literals — otherwise adding a fourth label to the enum
 * would leave both the schema and the test green while the model remained
 * unable to emit it.
 */
export const SENTIMENTS = ["positive", "negative", "mixed"] as const;

export const summarySchema = z.object({
  summary: z.string(),
  sentiment: z.enum(SENTIMENTS),
});

export type TSummary = z.infer<typeof summarySchema>;

function makeSummaryPrompt(prediction: TPrediction): string {
  const facets = PREDICTION_FACETS
    .map((facet) => `${facet}: ${prediction[facet]}`)
    .join("\n\n");

  return `Here is one day's horoscope for a single sun sign, broken into six facets.

${facets}

Write:
1. "summary" — the whole day in a single sentence of at most ${SUMMARY_MAX_LENGTH} characters. Address the reader as "you". No sign name, no date, no emoji, no quotation marks.
2. "sentiment" — "positive" if the day reads as broadly favorable, "negative" if it reads as broadly cautionary, "mixed" if the facets genuinely pull in both directions. Do not default to "mixed" for a day that is merely uneventful.`;
}

/**
 * Condenses a prediction into a one-line summary and a sentiment label.
 *
 * `model` is a defaulted trailing parameter so tests can inject a mock — the
 * same shape Magic Meal Kit uses for every one of its AI calls.
 */
export async function summarizePrediction(
  prediction: TPrediction,
  model: LanguageModel = SUMMARY_MODEL,
): Promise<TSummary> {
  const result = await generateText({
    model,
    system: "You are a horoscope editor who writes tight, plain-spoken copy.",
    output: Output.object({ schema: summarySchema }),
    prompt: makeSummaryPrompt(prediction),
  });

  // `Output.object` yields `undefined` when the model finishes without a usable
  // object rather than throwing, so this is a real branch, not defensive noise.
  if (!result.output) {
    throw new Error("Summarization returned no object");
  }

  return {
    ...result.output,
    summary: truncateSummary(result.output.summary),
  };
}

/**
 * Trims a summary to the cap on a word boundary where one is available.
 *
 * Cutting mid-word reads as a bug to anyone looking at the row; cutting at a
 * space reads as a short sentence.
 */
export function truncateSummary(summary: string): string {
  const trimmed = summary.trim();
  if (trimmed.length <= SUMMARY_MAX_LENGTH) return trimmed;

  const clipped = trimmed.slice(0, SUMMARY_MAX_LENGTH);
  const lastSpace = clipped.lastIndexOf(" ");
  // Only respect a word boundary in the last quarter; an early space would
  // throw away most of the sentence to save one partial word.
  const cut = lastSpace > SUMMARY_MAX_LENGTH * 0.75
    ? lastSpace
    : clipped.length;
  return clipped.slice(0, cut).trimEnd();
}
