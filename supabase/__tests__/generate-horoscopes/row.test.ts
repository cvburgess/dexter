import { assert, assertEquals } from "@std/assert";

import { toHoroscopeRow } from "../../functions/generate-horoscopes/row.ts";
import type { TPredictionResponse } from "../../functions/generate-horoscopes/astrology.ts";

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
    personal_life_rating: 6,
    profession_rating: 7,
    health_rating: 5,
    emotions_rating: 6,
    travel_rating: 8,
    luck_rating: 7,
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
  const row = toHoroscopeRow("taurus", response, summary);

  assertEquals(row.personal_life, "a");
  assertEquals(row.profession, "b");
  assertEquals(row.health, "c");
  assertEquals(row.emotions, "d");
  assertEquals(row.travel, "e");
  assertEquals(row.luck, "f");
  assertEquals(row.personal_life_rating, 6);
  assertEquals(row.profession_rating, 7);
  assertEquals(row.health_rating, 5);
  assertEquals(row.emotions_rating, 6);
  assertEquals(row.travel_rating, 8);
  assertEquals(row.luck_rating, 7);
});

Deno.test("the summary and sentiment are carried across", () => {
  const row = toHoroscopeRow("gemini", response, summary);

  assertEquals(row.summary, "A quiet day.");
  assertEquals(row.sentiment, "positive");
});

Deno.test("average_rating is left to the database", () => {
  // It is a stored generated column. Sending a value would be rejected by
  // Postgres, so the row must omit it entirely.
  const row = toHoroscopeRow("cancer", response, summary);

  assert(
    !("average_rating" in row),
    "average_rating is generated; including it in the insert fails at runtime",
  );
});
