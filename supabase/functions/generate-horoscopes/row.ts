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
 */
export function toHoroscopeRow(
  sign: TSunSign,
  response: TPredictionResponse,
  summary: TSummary,
): THoroscopeRow {
  // Spread rather than eighteen lines of `x: prediction.x`. Every key in
  // `TPrediction` and `TSummary` is already its column name, and a hand-written
  // mapping is where `health: prediction.emotions` compiles cleanly. A renamed
  // column still fails typecheck here, since the result must satisfy
  // `TablesInsert<"horoscopes">`.
  return {
    ...response.prediction,
    ...summary,
    sun_sign: sign,
    date: parsePredictionDate(response.prediction_date),
  };
}
