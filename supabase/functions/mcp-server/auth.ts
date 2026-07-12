import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@src/types/database.types.ts";

export interface AuthSuccess {
  ok: true;
  supabase: SupabaseClient<Database>;
  user: User;
}

interface AuthFailure {
  ok: false;
}

export type AuthResult = AuthFailure | AuthSuccess;

export async function validateBearerToken(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!supabaseUrl || !publishableKeys) {
    throw new Error("Missing Supabase environment configuration");
  }

  // Supabase injects the new publishable keys as a JSON dictionary keyed by
  // name; the initial migration ships a single key named "default".
  const supabasePublishableKey = JSON.parse(publishableKeys)["default"];

  const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { ok: false };

  return { ok: true, supabase, user };
}
