import { assert, assertEquals, assertObjectMatch } from "@std/assert";

import { toHoroscopeRow } from "../../functions/generate-horoscopes/row.ts";
import {
  predictionResponseSchema,
  type TPredictionResponse,
} from "../../functions/generate-horoscopes/astrology.ts";

// DEX-84.

const response: TPredictionResponse = {
  sun_sign: "Aries",
  prediction_date: "21-3-2024",
  prediction: {
    personal_life: "a",
    profession: "b",
    health: "c",
    emotions: "d",
    travel: "e",
    luck: "f",
  },
};

const summary = { summary: "A quiet day.", sentiment: "positive" as const };

Deno.test("the row uses the requested sign, not the upstream echo", () => {
  // `response.sun_sign` is free-form text ("Aries" here, capitalized) and would
  // not match the enum. The sign we asked for is what decides the row's identity.
  const row = toHoroscopeRow("aries", response, summary);

  assertEquals(row.sun_sign, "aries");
});

Deno.test("the date comes from the response, not from the local clock", () => {
  // The API is the authority on which day it just described. Computing
  // "tomorrow" here instead would write the text under the wrong date whenever
  // the two disagree — which is exactly what the 05:00–10:00 UTC cron window
  // exists to make rare, not impossible.
  const row = toHoroscopeRow("aries", response, summary);

  assertEquals(row.date, "2024-03-21");
});

Deno.test("every prediction facet and rating is carried across", () => {
  // Asserted wholesale rather than field by field: the mapping is a spread, so
  // the invariant is "nothing is dropped or renamed", and this keeps holding
  // when a facet is added.
  assertObjectMatch(
    toHoroscopeRow("taurus", response, summary),
    response.prediction,
  );
});

Deno.test("the summary and sentiment are carried across", () => {
  assertObjectMatch(toHoroscopeRow("gemini", response, summary), summary);
});

Deno.test("an added upstream field never reaches the insert", () => {
  // `toHoroscopeRow` spreads the prediction, so on its own it would carry any
  // extra key straight into the insert — where PostgREST rejects it as an
  // unknown column, taking all twelve rows with it since they go up in one
  // upsert. What actually prevents that is zod stripping unknown keys in
  // `parse`, so the guarantee only holds end to end. This asserts the pair
  // rather than the spread alone: the upstream has already changed shape once
  // here (the 2024 sample's `<facet>_rating` fields are gone), so it can again.
  const parsed = predictionResponseSchema.parse({
    ...response,
    prediction: { ...response.prediction, luck_rating: 7, brand_new: "x" },
  });
  const row = toHoroscopeRow("cancer", parsed, summary);

  assert(!("luck_rating" in row), "a dropped column must not come back");
  assert(
    !("brand_new" in row),
    "an unknown upstream field must not reach the insert",
  );
});
