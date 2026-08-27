import { SupabaseClient } from "@supabase/supabase-js";

import { camelCase } from "@/utils/changeCase";
import { Database } from "@/types/database.types";

/** One of the twelve signs. Sourced from the DB enum so the two can't drift. */
export type TSunSign = Database["public"]["Enums"]["sun_sign"];

/** How the day reads overall — what the ritual step's background is tinted by. */
export type THoroscopeSentiment =
  Database["public"]["Enums"]["horoscope_sentiment"];

/**
 * Global reference data — no `user_id`; `preferences.sun_sign` picks yours
 * (DEX-84, DEX-145). `sentiment` derives from `overallRating` in the DB.
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
  // The generator runs once a day and only forward, so an uncovered date is an
  // empty state, not an error — it has to be distinguishable from a row.
  if (!data) return null;

  return camelCase(data) as THoroscope;
};
