import { SupabaseClient } from "@supabase/supabase-js";

import { TSunSign } from "@/api/horoscopes";
import { camelCase, snakeCase } from "@/utils/changeCase";
import { Database, TablesUpdate } from "@/types/database.types";

export enum EThemeMode {
  SYSTEM,
  LIGHT,
  DARK,
}

export type TPreferences = {
  /** A `TAlarmSound` value — see `ALARM_SOUNDS` in `utils/alarms.shared.ts`.
   * Typed as `string` because the DB column is unconstrained text: an older
   * build must be able to read a sound it doesn't know about. */
  alarmSound: string;
  calendarEndTime: string;
  calendarStartTime: string;
  calendarUrls: string[];
  darkTheme: string;
  enableCalendar: boolean;
  enableHabits: boolean;
  enableJournal: boolean;
  enableNotes: boolean;
  lightTheme: string;
  /** The sign the Horoscope ritual step reads for, or `null` when unset —
   * the only preference with no sensible default, since guessing one would
   * show a stranger's horoscope as though it were the user's (DEX-128). This
   * is the one nullable field in this type; treat it as a real state rather
   * than coalescing it to a sign. */
  sunSign: TSunSign | null;
  templateNote: string;
  templatePrompts: string[];
  themeMode: EThemeMode;
};

export const getPreferences = async (supabase: SupabaseClient<Database>) => {
  const { data, error } = await supabase
    .from("preferences")
    .select("*")
    .limit(1)
    .single();

  if (error) throw error;
  return camelCase(data) as TPreferences;
};

export type TUpdatePreferences = {
  alarmSound?: string;
  calendarEndTime?: string;
  calendarStartTime?: string;
  calendarUrls?: string[];
  darkTheme?: string;
  enableCalendar?: boolean;
  enableHabits?: boolean;
  enableJournal?: boolean;
  enableNotes?: boolean;
  lightTheme?: string;
  /** `null` clears the sign back to unset, which is why this is nullable
   * rather than merely optional — omitting it leaves the stored sign alone. */
  sunSign?: TSunSign | null;
  templateNote?: string;
  templatePrompts?: string[];
  themeMode?: EThemeMode;
  userId: string;
};

export const updatePreferences = async (
  supabase: SupabaseClient<Database>,
  { userId, ...diff }: TUpdatePreferences,
) => {
  const { data, error } = await supabase
    .from("preferences")
    .update(snakeCase(diff) as TablesUpdate<"preferences">)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return camelCase(data) as TPreferences;
};
