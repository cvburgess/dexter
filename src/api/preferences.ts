import { SupabaseClient } from "@supabase/supabase-js";

import { TSunSign } from "@/api/horoscopes";
import { camelCase, snakeCase } from "@/utils/changeCase";
import {
  parseTemplatePrompts,
  type TTemplatePrompt,
} from "@/utils/journalPrompts";
import { Database, Tables, TablesUpdate } from "@/types/database.types";

export enum EThemeMode {
  SYSTEM,
  LIGHT,
  DARK,
}

export type TPreferences = {
  /** A `TAlarmSound` value, typed `string`: the column is unconstrained text,
   * so an older build must be able to read a sound it doesn't know about. */
  alarmSound: string;
  /** Breaths the Breathe step opens with (DEX-164). Unconstrained column, so
   * older builds must read unknown counts; `resolveBreathCount` narrows them. */
  breathCount: number;
  /** A `TBreathingTechniqueSetting` value, including `"shuffle"` — typed
   * `string` for the reason `alarmSound` is. */
  breathingTechnique: string;
  calendarEndTime: string;
  calendarStartTime: string;
  calendarUrls: string[];
  darkTheme: string;
  enableCalendar: boolean;
  enableHabits: boolean;
  /** DEX-142: independent of `sunSign` — toggling off keeps the stored sign,
   * so re-enabling restores the horoscope rather than re-asking. */
  enableHoroscope: boolean;
  enableJournal: boolean;
  enableNotes: boolean;
  /** Whole minutes (DEX-49). Unconstrained column, so an older build must read
   * lengths it doesn't offer; `resolveFocusBlockMinutes` narrows them back. */
  focusBlockMinutes: number;
  lightTheme: string;
  /** `null` when unset — the one preference with no sensible default: guessing
   * would show a stranger's horoscope as the user's (DEX-128). Never coalesce. */
  sunSign: TSunSign | null;
  templateNote: string;
  /** The journal's prompts, each carrying the ritual that asks it (DEX-151).
   * jsonb, so it arrives untyped — read only via `parseTemplatePrompts`. */
  templatePrompts: TTemplatePrompt[];
  themeMode: EThemeMode;
};

export const getPreferences = async (supabase: SupabaseClient<Database>) => {
  const { data, error } = await supabase
    .from("preferences")
    .select("*")
    .limit(1)
    .single();

  if (error) throw error;
  return rowToPreferences(data);
};

/**
 * `template_prompts` is jsonb, so the blind cast every other field rides on would
 * be a lie for it. Runs on the fetch and the write, like `rowToJournal`.
 */
const rowToPreferences = (data: Tables<"preferences">): TPreferences => ({
  ...(camelCase(data) as TPreferences),
  templatePrompts: parseTemplatePrompts(data.template_prompts),
});

export type TUpdatePreferences = {
  alarmSound?: string;
  breathCount?: number;
  breathingTechnique?: string;
  calendarEndTime?: string;
  calendarStartTime?: string;
  calendarUrls?: string[];
  darkTheme?: string;
  enableCalendar?: boolean;
  enableHabits?: boolean;
  enableHoroscope?: boolean;
  enableJournal?: boolean;
  enableNotes?: boolean;
  focusBlockMinutes?: number;
  lightTheme?: string;
  /** `null` clears the sign back to unset, which is why this is nullable
   * rather than merely optional — omitting it leaves the stored sign alone. */
  sunSign?: TSunSign | null;
  templateNote?: string;
  /** The whole list, every time. */
  templatePrompts?: TTemplatePrompt[];
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
  return rowToPreferences(data);
};
