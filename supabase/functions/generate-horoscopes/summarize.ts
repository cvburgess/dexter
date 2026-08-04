// LLM summarization for DEX-84.
//
// Follows the Magic Meal Kit convention for AI SDK calls (see its commit
// fc837087, "Migrate AI SDK calls to Vercel AI Gateway"): a bare
// `provider/model` string rather than a constructed provider, structured output
// via `generateText` + `Output.object`, and AI_GATEWAY_API_KEY read implicitly
// by the SDK rather than through `Deno.env.get`. There is no gateway client to
// build and no key to validate here.

import {
  APICallError,
  generateText,
  type LanguageModel,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
} from "ai";
import { z } from "zod";

import { PREDICTION_FACETS, type TPrediction } from "./astrology.ts";
import { withRetry } from "./retry.ts";

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

/** A gateway failure that another attempt could plausibly get past. */
const RATE_LIMIT_PATTERN = /rate limit|too many requests|overloaded/i;

export function isRetryableModelError(error: unknown): boolean {
  // A model that finished without a usable object is the most retryable failure
  // there is — the same prompt often produces valid output next time. This is
  // also the shape Magic Meal Kit absorbs with a fallback model.
  if (
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error)
  ) {
    return true;
  }

  if (APICallError.isInstance(error)) {
    // The SDK's own verdict first; it knows more about the provider than we do.
    if (typeof error.isRetryable === "boolean") return error.isRetryable;
    const status = error.statusCode ?? 0;
    return status === 429 || status >= 500;
  }

  if (error instanceof Error) {
    if (error.name === "RateLimitError") return true;
    if (RATE_LIMIT_PATTERN.test(error.message)) return true;
    // How `fetch` reports a connection that never completed.
    if (error instanceof TypeError) return true;
  }

  // Anything else — a bad key, a malformed request, our own bug — is
  // deterministic, and retrying only spends the budget three times over.
  return false;
}

/**
 * Condenses a prediction into a one-line summary and a sentiment label.
 *
 * `model` is a defaulted trailing parameter so tests can inject a mock — the
 * same shape Magic Meal Kit uses for every one of its AI calls.
 *
 * Retries transient gateway failures. The retry wraps only this call, so a
 * summarization that needs a second attempt does not re-pay for the
 * AstrologyAPI request that produced its input.
 */
export function summarizePrediction(
  prediction: TPrediction,
  model: LanguageModel = SUMMARY_MODEL,
  sleep?: (ms: number) => Promise<void>,
): Promise<TSummary> {
  return withRetry(async () => {
    const result = await generateText({
      model,
      system: "You are a horoscope editor who writes tight, plain-spoken copy.",
      output: Output.object({ schema: summarySchema }),
      prompt: makeSummaryPrompt(prediction),
    });

    // `Output.object` yields `undefined` when the model finishes without a
    // usable object rather than throwing, so this is a real branch.
    if (!result.output) {
      throw new NoOutputGeneratedError({
        message: "Summarization returned no object",
      });
    }

    return {
      ...result.output,
      summary: truncateSummary(result.output.summary),
    };
  }, {
    label: "Horoscope summarization",
    isRetryable: isRetryableModelError,
    sleep,
  });
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
