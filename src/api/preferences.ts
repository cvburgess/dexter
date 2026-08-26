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
  /** A `TAlarmSound` value — see `ALARM_SOUNDS` in `utils/alarms.shared.ts`.
   * Typed as `string` because the DB column is unconstrained text: an older
   * build must be able to read a sound it doesn't know about. */
  alarmSound: string;
  /** How many breaths the Breathe ritual step opens with (DEX-164). A plain
   * number, like `focusBlockMinutes` and for the same reason: the column is
   * unconstrained, so an older build must be able to read a count it doesn't
   * offer. `resolveBreathCount` narrows it at the read site. */
  breathCount: number;
  /** Which pattern the Breathe step opens with — a `TBreathingTechniqueSetting`
   * value, which includes `"shuffle"` (see `utils/breathing.ts`). Typed as
   * `string` for the reason `alarmSound` is. */
  breathingTechnique: string;
  calendarEndTime: string;
  calendarStartTime: string;
  calendarUrls: string[];
  darkTheme: string;
  enableCalendar: boolean;
  enableHabits: boolean;
  /** Whether the Ritual's morning walk includes its Horoscope step (DEX-142).
   * Independent of `sunSign`: turning the step off leaves a chosen sign stored,
   * so turning it back on restores the horoscope rather than re-asking. */
  enableHoroscope: boolean;
  enableJournal: boolean;
  enableNotes: boolean;
  /** How long a focus block runs, in whole minutes (DEX-49). Typed as a plain
   * number because the DB column is unconstrained: an older build must be able
   * to read a length it doesn't offer, which `resolveFocusBlockMinutes` narrows
   * back to one it does. */
  focusBlockMinutes: number;
  lightTheme: string;
  /** The sign the Horoscope ritual step reads for, or `null` when unset —
   * the only preference with no sensible default, since guessing one would
   * show a stranger's horoscope as though it were the user's (DEX-128). This
   * is the one nullable field in this type; treat it as a real state rather
   * than coalescing it to a sign. */
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
