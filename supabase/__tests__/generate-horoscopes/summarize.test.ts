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
import {
  mockGenerateMeta,
  MockLanguageModel,
  objectModel,
} from "../helpers/mockLanguageModel.ts";

// DEX-84. The model is a defaulted trailing parameter precisely so these run
// against a mock — no gateway key, no network.

const prediction = {
  personal_life: "Solitude suits you today.",
  profession: "A spiritual conversation eases work pressure.",
  health: "Watch for overindulgence.",
  emotions: "Vivid dreams and intense feelings.",
  travel: "A short reflective retreat rewards you.",
  luck: "Trust your instincts.",
  personal_life_rating: 6,
  profession_rating: 7,
  health_rating: 5,
  emotions_rating: 6,
  travel_rating: 8,
  luck_rating: 7,
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

Deno.test("a model that returns no object fails the sign loudly", async () => {
  // `Output.object` yields undefined rather than throwing when the model
  // finishes without a usable object, so this is a real branch. It must reject,
  // so the sign lands in the failure count instead of writing an empty row.
  const model = new MockLanguageModel({
    doGenerate: () =>
      Promise.resolve({
        content: [{ type: "text" as const, text: "not json at all" }],
        ...mockGenerateMeta,
      }),
  });

  await assertRejects(() => summarizePrediction(prediction, model));
});

Deno.test("an unknown sentiment is rejected", async () => {
  // The column is an enum; a stray label would fail the insert for every sign in
  // the batch rather than just this one.
  const model = objectModel({ summary: "ok", sentiment: "euphoric" });

  await assertRejects(() => summarizePrediction(prediction, model));
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
