import { SupabaseClient } from "@supabase/supabase-js";

import { camelCase } from "@/utils/changeCase";
import { Database } from "@/types/database.types";

/** One of the twelve signs. Sourced from the DB enum so the two can't drift. */
export type TSunSign = Database["public"]["Enums"]["sun_sign"];

/** How the day reads overall — what the ritual step's background is tinted by. */
export type THoroscopeSentiment =
  Database["public"]["Enums"]["horoscope_sentiment"];

/**
 * A day's prediction for one sign (DEX-84).
 *
 * Global reference data, not user data: the table has no `user_id` and every
 * signed-in user reads the same twelve rows a day. `preferences.sun_sign` is
 * the only user-scoped half — it says which of them is yours.
 *
 * The six facets after `sentiment` are the detail the Horoscope ritual step
 * scrolls to reveal; `summary` is the ~100-character condensation shown above
 * them. See `HOROSCOPE_FACETS` in `utils/horoscope.ts` for the reading order
 * and labels.
 */
export type THoroscope = {
  sunSign: TSunSign;
  date: string;
  summary: string;
  sentiment: THoroscopeSentiment;
  personalLife: string;
  profession: string;
  health: string;
  emotions: string;
  travel: string;
  luck: string;
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
