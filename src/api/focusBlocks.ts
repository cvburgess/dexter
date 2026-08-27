import { SupabaseClient } from "@supabase/supabase-js";

import { TTask } from "@/api/tasks";
import { camelCase, snakeCase } from "@/utils/changeCase";
import { TFocusBlockStatus } from "@/utils/focusBlocks";
import { Database, TablesInsert, TablesUpdate } from "@/types/database.types";

// One Pomodoro-style timer (DEX-49); remainingSeconds + resumedAt are an
// anchor, not a live countdown — see utils/focusBlocks.ts.
export type TFocusBlock = {
  /** The **local** day this block belongs to, stamped once when it starts.
   * What the ritual's Review step counts by. */
  date: string;
  id: string;
  remainingSeconds: number;
  /** When the current run began; `null` unless `status` is `"active"`. */
  resumedAt: string | null;
  status: TFocusBlockStatus;
  taskId: string;
  tasks: TTask;
  totalSeconds: number;
};

const FOCUS_BLOCK_SELECT = "*, tasks(*)";

// `.limit(1)` + first row, not `.maybeSingle()`: a pre-existing duplicate pair
// makes maybeSingle throw PGRST116, and a crashed timer bar is worse than a stale one.
export const getLiveFocusBlock = async (
  supabase: SupabaseClient<Database>,
): Promise<TFocusBlock | null> => {
  const { data, error } = await supabase
    .from("focus_blocks")
    .select(FOCUS_BLOCK_SELECT)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  const [block] = camelCase(data) as TFocusBlock[];
  return block ?? null;
};

/** Every block belonging to one local day — what the Review step counts. */
export const getFocusBlocks = async (
  supabase: SupabaseClient<Database>,
  date: string,
) => {
  const { data, error } = await supabase
    .from("focus_blocks")
    .select(FOCUS_BLOCK_SELECT)
    .eq("date", date)
    .order("created_at");

  if (error) throw error;
  return camelCase(data) as TFocusBlock[];
};

export type TCreateFocusBlock = {
  date: string;
  remainingSeconds: number;
  resumedAt: string;
  taskId: string;
  totalSeconds: number;
};

export const createFocusBlock = async (
  supabase: SupabaseClient<Database>,
  block: TCreateFocusBlock,
) => {
  const { data, error } = await supabase
    .from("focus_blocks")
    .insert(snakeCase(block) as TablesInsert<"focus_blocks">)
    .select(FOCUS_BLOCK_SELECT)
    .single();

  if (error) throw error;
  return camelCase(data) as TFocusBlock;
};

export type TUpdateFocusBlock = {
  id: string;
  remainingSeconds?: number;
  /** Always written alongside `status` — `resumed_at_iff_active` rejects a
   * mismatched pair. */
  resumedAt?: string | null;
  status?: TFocusBlockStatus;
};

export const updateFocusBlock = async (
  supabase: SupabaseClient<Database>,
  { id, ...diff }: TUpdateFocusBlock,
) => {
  const { data, error } = await supabase
    .from("focus_blocks")
    .update(snakeCase(diff) as TablesUpdate<"focus_blocks">)
    .eq("id", id)
    .select(FOCUS_BLOCK_SELECT)
    .single();

  if (error) throw error;
  return camelCase(data) as TFocusBlock;
};
