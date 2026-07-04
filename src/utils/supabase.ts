import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

import { Database } from "@/types/database.types";

const getSupabaseEnv = () => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return {
    supabaseAnonKey,
    supabaseUrl,
  };
};

const { supabaseAnonKey, supabaseUrl } = getSupabaseEnv();

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // PKCE makes magic-link and OAuth callbacks return a ?code= param that
    // handleAuthCallbackUrl exchanges for a session.
    flowType: "pkce",
    persistSession: true,
    storage: AsyncStorage,
  },
});

// On native, the auto-refresh timer is suspended while the app is
// backgrounded, so the access token can silently expire. Tie the timer to
// AppState so the token is eagerly refreshed when the app returns to the
// foreground. The browser keeps timers running, so this is unnecessary on web.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
