import { SupabaseClient } from "@supabase/supabase-js";

import { camelCase, snakeCase } from "@/utils/changeCase";
import type { TRitualMode } from "@/utils/ritualSteps";
import { Database, Tables, TablesInsert } from "@/types/database.types";

/**
 * `period` (DEX-151) is optional because the stored rows are — read it through
 * `promptPeriod`. Stamped at seed time so a renamed prompt can't move an old day.
 */
export type TJournalPrompt = {
  prompt: string;
  response: string;
  period?: TRitualMode;
};

/** `mood` (DEX-191) is 1-5 or `null` for unanswered — never coerced to a number. */
export type TJournal = {
  date: string;
  prompts: TJournalPrompt[];
  mood: number | null;
};

// Normalize a raw `journals` row into `TJournal`, coercing a null `prompts` to
// `[]`. The column is NOT NULL, but `TJournal.prompts` is `TJournalPrompt[]` and
// callers `.map()` it / read `.length`, so neither the fetch (`getJournal`) nor
// the write (`upsertJournal`) may leak a null into the React Query cache.
const rowToJournal = (data: Tables<"journals">): TJournal => {
  const row = camelCase(data) as TJournal;
  return {
    ...row,
    prompts: (data.prompts ?? []) as TJournalPrompt[],
    mood: data.mood ?? null,
  };
};

export const getJournal = async (
  supabase: SupabaseClient<Database>,
  date: string,
) => {
  const { data, error } = await supabase
    .from("journals")
    .select("*")
    .eq("date", date)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  // No row yet for this day — distinct from an existing row with unanswered
  // prompts, so callers can tell "never started" apart from "started but blank".
  if (!data) return null;

  return rowToJournal(data);
};

export type TUpsertJournal = {
  date: string;
  prompts?: TJournalPrompt[];
  mood?: number | null;
};

export const upsertJournal = async (
  supabase: SupabaseClient<Database>,
  diff: TUpsertJournal,
) => {
  const { data, error } = await supabase
    .from("journals")
    .upsert(snakeCase(diff) as TablesInsert<"journals">, {
      // The table is keyed (user_id, date) and `user_id` is never sent (column
      // default + RLS), so name the target explicitly — PostgREST would
      // otherwise infer the conflict target from the payload's columns alone.
      onConflict: "user_id,date",
    })
    .select()
    .single();

  if (error) throw error;
  return rowToJournal(data);
};
