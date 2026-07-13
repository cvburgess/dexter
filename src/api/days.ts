import { SupabaseClient } from "@supabase/supabase-js";

import { camelCase, snakeCase } from "@/utils/changeCase";
import { Database, TablesUpdate } from "@/types/database.types";

export type TJournalPrompt = { prompt: string; response: string };

export type TDay = { date: string; notes: string; prompts: TJournalPrompt[] };

export const getDay = async (
  supabase: SupabaseClient<Database>,
  date: string,
) => {
  const { data, error } = await supabase
    .from("days")
    .select("*")
    .eq("date", date)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  // No row yet for this day — distinct from an existing row with an empty
  // note, so callers can tell "never started" apart from "started but blank".
  if (!data) return null;

  // Coerce a null `prompts` to `[]`. The column is NOT NULL going forward, but
  // rows written before that migration (and by other shared clients) may still
  // carry null, and `TDay.prompts` is `TJournalPrompt[]` — callers `.map()` it.
  return { ...camelCase(data), prompts: data.prompts ?? [] } as TDay;
};

export type TUpsertDay = {
  date: string;
  notes?: string;
  prompts?: TJournalPrompt[];
};

export const upsertDay = async (
  supabase: SupabaseClient<Database>,
  diff: TUpsertDay,
) => {
  const { data, error } = await supabase
    .from("days")
    .upsert(snakeCase(diff) as TablesUpdate<"days">)
    .select()
    .single();

  if (error) throw error;
  return camelCase(data) as TDay;
};
