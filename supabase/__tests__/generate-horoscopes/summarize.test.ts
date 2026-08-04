import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";

import {
  summarizePrediction,
  SUMMARY_MAX_LENGTH,
  truncateSummary,
} from "../../functions/generate-horoscopes/summarize.ts";
import { PREDICTION_FACETS } from "../../functions/generate-horoscopes/astrology.ts";
import { MAX_ATTEMPTS } from "../../functions/generate-horoscopes/retry.ts";
import {
  mockGenerateMeta,
  MockLanguageModel,
  objectModel,
} from "../helpers/mockLanguageModel.ts";

// DEX-84. The model is a defaulted trailing parameter precisely so these run
// against a mock — no gateway key, no network.

/** Injected in place of the real backoff so retry tests do not wait. */
const noSleep = () => Promise.resolve();

/** A model that always answers with text `Output.object` cannot parse. */
const unusableModel = () =>
  new MockLanguageModel({
    doGenerate: () =>
      Promise.resolve({
        content: [{ type: "text" as const, text: "not json at all" }],
        ...mockGenerateMeta,
      }),
  });

const prediction = {
  personal_life: "Solitude suits you today.",
  profession: "A spiritual conversation eases work pressure.",
  health: "Watch for overindulgence.",
  emotions: "Vivid dreams and intense feelings.",
  travel: "A short reflective retreat rewards you.",
  luck: "Trust your instincts.",
};

Deno.test("a summary and sentiment are read off the model output", async () => {
  const model = objectModel({
    summary: "A quiet day that rewards trusting your gut.",
    sentiment: "positive",
  });

  const result = await summarizePrediction(prediction, model);

  assertEquals(result.summary, "A quiet day that rewards trusting your gut.");
  assertEquals(result.sentiment, "positive");
});

Deno.test("the prompt carries all six facets", async () => {
  const model = objectModel({ summary: "ok", sentiment: "mixed" });
  await summarizePrediction(prediction, model);

  const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
  for (const facet of PREDICTION_FACETS) {
    assertStringIncludes(
      prompt,
      prediction[facet],
      `${facet} is missing from the prompt, so the summary cannot reflect it`,
    );
  }
});

Deno.test("an over-long summary is truncated rather than lost", async () => {
  // The cap lives in the prompt, not the schema, on purpose: `.max()` would
  // raise NoObjectGeneratedError and throw away the whole generation over a few
  // characters. This is the branch that makes that safe.
  const model = objectModel({
    summary: "x".repeat(SUMMARY_MAX_LENGTH + 50),
    sentiment: "negative",
  });

  const result = await summarizePrediction(prediction, model);

  assert(result.summary.length <= SUMMARY_MAX_LENGTH);
  assertEquals(result.sentiment, "negative");
});

Deno.test("a model that returns no object is retried, then fails the sign", async () => {
  // `Output.object` yields undefined rather than throwing when the model
  // finishes without a usable object. That is the most retryable failure there
  // is — the same prompt often produces valid output next time — but once the
  // attempts are spent it must still reject, so the sign lands in the failure
  // count instead of writing an empty row.
  const model = unusableModel();

  await assertRejects(() => summarizePrediction(prediction, model, noSleep));

  assertEquals(model.doGenerateCalls.length, MAX_ATTEMPTS);
});

Deno.test("a transient bad generation recovers on a retry", async () => {
  // The whole point of retrying: one unusable response should not cost the sign.
  let call = 0;
  const model = new MockLanguageModel({
    doGenerate: () => {
      call++;
      return Promise.resolve({
        content: [{
          type: "text" as const,
          text: call === 1 ? "not json at all" : JSON.stringify({
            summary: "A quiet day.",
            sentiment: "positive",
          }),
        }],
        ...mockGenerateMeta,
      });
    },
  });

  const result = await summarizePrediction(prediction, model, noSleep);

  assertEquals(result.summary, "A quiet day.");
  assertEquals(model.doGenerateCalls.length, 2);
});

Deno.test("an unknown sentiment is rejected", async () => {
  // The column is an enum; a stray label would fail the insert for every sign in
  // the batch rather than just this one.
  const model = objectModel({ summary: "ok", sentiment: "euphoric" });

  await assertRejects(() => summarizePrediction(prediction, model, noSleep));
});

Deno.test("a non-transient model error is not retried", async () => {
  // A bad gateway key is deterministic; three attempts per sign would spend the
  // budget three times over and delay the error that explains the failure.
  const model = new MockLanguageModel({
    doGenerate: () =>
      Promise.reject(new Error("Unauthorized: invalid API key")),
  });

  await assertRejects(() => summarizePrediction(prediction, model, noSleep));

  assertEquals(model.doGenerateCalls.length, 1);
});

Deno.test("a rate-limited model call is retried", async () => {
  const model = new MockLanguageModel({
    doGenerate: () =>
      Promise.reject(new Error("Rate limit exceeded, retry later")),
  });

  await assertRejects(() => summarizePrediction(prediction, model, noSleep));

  assertEquals(model.doGenerateCalls.length, MAX_ATTEMPTS);
});

Deno.test("truncation prefers a word boundary but never a stub", () => {
  const short = "A quiet day.";
  assertEquals(truncateSummary(short), short);
  assertEquals(truncateSummary(`  ${short}  `), short);

  const wordy = `${"word ".repeat(30)}end`;
  const truncated = truncateSummary(wordy);
  assert(truncated.length <= SUMMARY_MAX_LENGTH);
  assert(!truncated.endsWith(" "), "a trailing space reads as a rendering bug");
  assert(!truncated.startsWith(" "));

  // A single unbroken token has no boundary to prefer; cutting at the cap is
  // better than returning almost nothing.
  const unbroken = "x".repeat(SUMMARY_MAX_LENGTH * 2);
  assertEquals(truncateSummary(unbroken).length, SUMMARY_MAX_LENGTH);
});
