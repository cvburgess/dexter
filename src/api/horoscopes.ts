import { SupabaseClient } from "@supabase/supabase-js";

import { camelCase } from "@/utils/changeCase";
import { Database } from "@/types/database.types";

/** One of the twelve signs. Sourced from the DB enum so the two can't drift. */
export type TSunSign = Database["public"]["Enums"]["sun_sign"];

/** How the day reads overall — what the ritual step's background is tinted by. */
export type THoroscopeSentiment =
  Database["public"]["Enums"]["horoscope_sentiment"];

/**
 * A day's horoscope for one sign (DEX-84; re-shaped for astrology-api.io v3 in
 * DEX-145).
 *
 * Global reference data, not user data: the table has no `user_id` and every
 * signed-in user reads the same twelve rows a day. `preferences.sun_sign` is
 * the only user-scoped half — it says which of them is yours.
 *
 * `text` is the reading itself (~35 words), shown in the step's hero. Below it
 * the step shows `tips` and then the twelve life-area ratings grouped into
 * three columns — see `LIFE_AREAS` and `ratingBucket` in `utils/horoscope.ts`.
 *
 * `sentiment` is derived in the database from `overallRating`, not sent by the
 * upstream, which is why the two can never disagree.
 */
export type THoroscope = {
  sunSign: TSunSign;
  date: string;
  text: string;
  overallRating: number;
  sentiment: THoroscopeSentiment;
  tips: string[];
  ratingIdentity: number;
  ratingHealth: number;
  ratingFinance: number;
  ratingCareer: number;
  ratingLove: number;
  ratingRelationships: number;
  ratingCreativity: number;
  ratingSpirituality: number;
  ratingHome: number;
  ratingLearning: number;
  ratingCommunication: number;
  ratingTravel: number;
};

export const getHoroscope = async (
  supabase: SupabaseClient<Database>,
  sunSign: TSunSign,
  date: string,
) => {
  const { data, error } = await supabase
    .from("horoscopes")
    .select("*")
    .eq("sun_sign", sunSign)
    .eq("date", date)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  // No row for this sign and day — the generator runs once a day and only
  // forward, so any date it hasn't covered (a day the user navigated back to,
  // or one further ahead than it has reached) legitimately has nothing. That is
  // an empty state, not an error, so it has to be distinguishable from a row.
  if (!data) return null;

  return camelCase(data) as THoroscope;
};
