// Maps an AstrologyAPI response plus its generated summary onto a
// `public.horoscopes` insert row.
//
// Typed against the generated database types over the `@src/` alias (the same
// way mcp-server does), so a column renamed in a migration fails `typecheck`
// here rather than at runtime.

import type { TablesInsert } from "@src/types/database.types.ts";

import {
  parsePredictionDate,
  type TPredictionResponse,
  type TSunSign,
} from "./astrology.ts";
import type { TSummary } from "./summarize.ts";

export type THoroscopeRow = TablesInsert<"horoscopes">;

/**
 * Builds the row for one sign.
 *
 * `sun_sign` comes from the sign we requested, not from `response.sun_sign`:
 * the upstream echo is free-form text, and it is the request that determines
 * which row this belongs to. `date` does come from the response, since the API
 * is the authority on which day it just described.
 *
 * `average_rating` is absent on purpose — it is a stored generated column.
 */
export function toHoroscopeRow(
  sign: TSunSign,
  response: TPredictionResponse,
  summary: TSummary,
): THoroscopeRow {
  const { prediction } = response;

  return {
    sun_sign: sign,
    date: parsePredictionDate(response.prediction_date),
    summary: summary.summary,
    sentiment: summary.sentiment,
    personal_life: prediction.personal_life,
    profession: prediction.profession,
    health: prediction.health,
    emotions: prediction.emotions,
    travel: prediction.travel,
    luck: prediction.luck,
    personal_life_rating: prediction.personal_life_rating,
    profession_rating: prediction.profession_rating,
    health_rating: prediction.health_rating,
    emotions_rating: prediction.emotions_rating,
    travel_rating: prediction.travel_rating,
    luck_rating: prediction.luck_rating,
  };
}
