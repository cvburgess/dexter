import { SupabaseClient } from "@supabase/supabase-js";

import { camelCase, snakeCase } from "@/utils/changeCase";
import type { TRitualMode } from "@/utils/ritualSteps";
import { Database, Tables, TablesInsert } from "@/types/database.types";

/**
 * One question in a day's journal, and the answer to it.
 *
 * `period` (DEX-151) says which ritual asks it, and is **optional because the
 * stored rows are**: every entry written before the AM/PM split carries none,
 * as does anything an older build writes today. Never read it directly — go
 * through `promptPeriod` in `utils/journalPrompts.ts`, which is the one place
 * that fallback to morning lives.
 *
 * The period is stamped onto the day's entries when they seed from the template
 * (`useJournals`) rather than looked up from the template at read time: a prompt
 * renamed or deleted in Settings must not change which ritual an already-written
 * day belongs to.
 */
export type TJournalPrompt = {
  prompt: string;
  response: string;
  period?: TRitualMode;
};

export type TJournal = { date: string; prompts: TJournalPrompt[] };

// Normalize a raw `journals` row into `TJournal`, coercing a null `prompts` to
// `[]`. The column is NOT NULL, but `TJournal.prompts` is `TJournalPrompt[]` and
// callers `.map()` it / read `.length`, so neither the fetch (`getJournal`) nor
// the write (`upsertJournal`) may leak a null into the React Query cache.
const rowToJournal = (data: Tables<"journals">): TJournal => {
  const row = camelCase(data) as TJournal;
  return { ...row, prompts: (data.prompts ?? []) as TJournalPrompt[] };
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
