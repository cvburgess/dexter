// Maps an astrology-api.io v3 response onto a `public.horoscopes` insert row.
//
// Typed against the generated database types over the `@src/` alias (the same
// way mcp-server does), so a column renamed in a migration fails `typecheck`
// here rather than at runtime.

import type { TablesInsert } from "@src/types/database.types.ts";

import {
  LIFE_AREAS,
  type THoroscopeData,
  type TLifeArea,
  type TLifeAreaRatings,
  toLifeAreaRatings,
  type TSunSign,
} from "./astrology.ts";

export type THoroscopeRow = TablesInsert<"horoscopes">;

/** The twelve rating columns, named from the areas they come from. */
type TRatingColumns = { [A in TLifeArea as `rating_${A}`]: number };

/**
 * Spreads the twelve ratings onto their columns.
 *
 * Built by mapping over `LIFE_AREAS` rather than written out as twelve lines,
 * because twelve hand-written assignments is exactly where
 * `rating_love: ratings.learning` compiles cleanly and ships a wrong number to
 * a reader. The template-literal key type is what keeps that safe without the
 * repetition: `TRatingColumns` is derived from the same list, and the row this
 * feeds must satisfy `TablesInsert<"horoscopes">` — so an area whose column is
 * missing, renamed, or misspelled is a type error at the call site.
 *
 * The cast is confined to `Object.fromEntries`, which is typed as returning a
 * string-keyed record and cannot express that mapping a closed list produces a
 * complete one.
 */
function toRatingColumns(ratings: TLifeAreaRatings): TRatingColumns {
  return Object.fromEntries(
    LIFE_AREAS.map((area) => [`rating_${area}`, ratings[area]]),
  ) as TRatingColumns;
}

/**
 * Builds the row for one sign.
 *
 * `sun_sign` comes from the sign we requested, not from `data.sign`: the
 * upstream echoes a capitalized display name (`"Aries"`), and it is the request
 * that determines which row this belongs to. `date` does come from the
 * response — we ask for a specific day and it echoes the day it answered for,
 * so it stays the authority, and `index.ts` reports any disagreement with the
 * date it expected.
 *
 * `sentiment` is deliberately absent: it is a generated column derived from
 * `overall_rating` in the database, so naming it here would be an error.
 */
export function toHoroscopeRow(
  sign: TSunSign,
  data: THoroscopeData,
): THoroscopeRow {
  return {
    sun_sign: sign,
    date: data.date,
    text: data.text,
    overall_rating: data.overall_rating,
    tips: data.tips,
    ...toRatingColumns(toLifeAreaRatings(data.life_area_focus)),
  };
}
