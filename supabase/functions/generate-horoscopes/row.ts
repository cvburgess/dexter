// Maps an astrology-api.io v3 response onto a `public.horoscopes` insert row.
// Typed against generated database types, so a renamed column fails here.

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
 * Maps over `LIFE_AREAS` rather than twelve hand-written assignments, where
 * `rating_love: ratings.learning` would compile cleanly and ship silently wrong.
 */
function toRatingColumns(ratings: TLifeAreaRatings): TRatingColumns {
  return Object.fromEntries(
    LIFE_AREAS.map((area) => [`rating_${area}`, ratings[area]]),
  ) as TRatingColumns;
}

/**
 * `sun_sign` comes from the request, not `data.sign` (the upstream echoes a
 * capitalized display name); `sentiment` is absent — it's a generated column.
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
