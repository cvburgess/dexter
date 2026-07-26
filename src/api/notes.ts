import { SupabaseClient } from "@supabase/supabase-js";

import { camelCase, snakeCase } from "@/utils/changeCase";
import { Database, TablesUpdate } from "@/types/database.types";

export type TNote = { date: string; content: string };

export const getNote = async (
  supabase: SupabaseClient<Database>,
  date: string,
) => {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("date", date)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  // No row yet for this day — distinct from an existing row with an empty
  // note, so callers can tell "never started" apart from "started but blank".
  if (!data) return null;

  return camelCase(data) as TNote;
};

export type TUpsertNote = {
  date: string;
  content?: string;
};

export const upsertNote = async (
  supabase: SupabaseClient<Database>,
  diff: TUpsertNote,
) => {
  const { data, error } = await supabase
    .from("notes")
    .upsert(snakeCase(diff) as TablesUpdate<"notes">, {
      // The table is keyed (user_id, date) and `user_id` is never sent (column
      // default + RLS), so name the target explicitly — PostgREST would
      // otherwise infer the conflict target from the payload's columns alone.
      onConflict: "user_id,date",
    })
    .select()
    .single();

  if (error) throw error;
  return camelCase(data) as TNote;
};
