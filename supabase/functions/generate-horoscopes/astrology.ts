// AstrologyAPI client for DEX-84.
//
// Everything in this module is pure or takes its `fetch` as an argument, so the
// whole upstream contract — the request shape, the response validation, and the
// date format — is testable without network access. Backend CI runs `deno test`
// with no network and no Postgres, so `index.ts` deliberately keeps nothing but
// I/O wiring.

import { z } from "zod";

/**
 * The twelve sun signs, in astrological order.
 *
 * Doubles as the value list of the `public.sun_sign` enum and as the path
 * segment AstrologyAPI expects, which is why it is lowercase. A test asserts it
 * matches the migration, so the two cannot drift.
 */
export const ZODIAC_SIGNS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
] as const;

export type TSunSign = typeof ZODIAC_SIGNS[number];

const API_BASE =
  "https://json.astrologyapi.com/v1/sun_sign_prediction/daily/next";

/** The six prediction facets, each of which also has a `<facet>_rating`. */
export const PREDICTION_FACETS = [
  "personal_life",
  "profession",
  "health",
  "emotions",
  "travel",
  "luck",
] as const;

// Ratings are third-party input that lands in a smallint column with a 0..10
// check constraint, so the bound is enforced here too — a 47 should fail as a
// legible validation error rather than as a constraint violation mid-upsert.
const ratingSchema = z.number().int().min(0).max(10);

export const predictionSchema = z.object({
  personal_life: z.string(),
  profession: z.string(),
  health: z.string(),
  emotions: z.string(),
  travel: z.string(),
  luck: z.string(),
  personal_life_rating: ratingSchema,
  profession_rating: ratingSchema,
  health_rating: ratingSchema,
  emotions_rating: ratingSchema,
  travel_rating: ratingSchema,
  luck_rating: ratingSchema,
});

export const predictionResponseSchema = z.object({
  sun_sign: z.string(),
  prediction_date: z.string(),
  prediction: predictionSchema,
});

export type TPrediction = z.infer<typeof predictionSchema>;
export type TPredictionResponse = z.infer<typeof predictionResponseSchema>;

/**
 * Converts AstrologyAPI's `D-M-YYYY` prediction date to an ISO `YYYY-MM-DD`
 * one for the `date` column.
 *
 * The upstream zero-pads neither the day nor the month (`"1-3-2024"`), and the
 * response date is used rather than a locally computed "tomorrow" on purpose:
 * the two can disagree, and the API's own answer is the one the text describes.
 */
export function parsePredictionDate(value: string): string {
  const match = value.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) {
    throw new Error(`Unrecognized prediction_date: ${value}`);
  }
  const [, day, month, year] = match;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) {
    throw new Error(`Out-of-range prediction_date: ${value}`);
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Fetches tomorrow's prediction for one sign.
 *
 * `fetchImpl` is injected rather than stubbed onto `globalThis` so tests never
 * touch the network — the same dependency-injection shape `_shared/sentry.ts`
 * uses for its client.
 */
export async function fetchPrediction(
  sign: TSunSign,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TPredictionResponse> {
  const response = await fetchImpl(`${API_BASE}/${sign}`, {
    method: "POST",
    headers: {
      // Token auth. AstrologyAPI also accepts HTTP Basic with a user id and key
      // pair; the header form needs only the one secret.
      "x-astrologyapi-key": apiKey,
      "Content-Type": "application/json",
      "Accept-Language": "en",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    // The upstream echoes the key in some error bodies, so the body is not
    // included in the message that reaches Sentry or the caller.
    throw new Error(
      `AstrologyAPI returned ${response.status} for ${sign}`,
    );
  }

  return predictionResponseSchema.parse(await response.json());
}
