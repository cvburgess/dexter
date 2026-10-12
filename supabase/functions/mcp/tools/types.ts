import type { SupabaseContext } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@src/types/database.types.ts";

export type ToolContext = {
  supabase: SupabaseClient<Database>;
  userClaims: NonNullable<SupabaseContext<Database>["userClaims"]>;
};
