import { SupabaseClient } from "@supabase/supabase-js";

import { TTask } from "@/api/tasks";
import { camelCase, snakeCase } from "@/utils/changeCase";
import { TFocusBlockStatus } from "@/utils/focusBlocks";
import { Database, TablesInsert, TablesUpdate } from "@/types/database.types";

/**
 * One Pomodoro-style timer (DEX-49). `remainingSeconds` + `resumedAt` are an
 * anchor rather than a live countdown — see `utils/focusBlocks.ts` and the
 * `add_focus_blocks` migration.
 */
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

/**
 * The block the timer UI is currently showing, or `null`.
 *
 * `.limit(1)` and take the first row rather than `.maybeSingle()`: the partial
 * unique index makes two live rows impossible from here on, but `maybeSingle`
 * *throws* `PGRST116` on a pre-existing pair, and a timer bar that crashes is a
 * worse failure than one showing the newer of two blocks.
 */
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
  /** Always written alongside `status`: the `resumed_at_iff_active` constraint
   * rejects a running block without an anchor, or a stopped one carrying a
   * stale anchor. */
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
