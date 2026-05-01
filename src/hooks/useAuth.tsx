import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";

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
const redirectTo = Linking.createURL("auth-callback");

export type TToken = {
  access_token: string;
  refresh_token: string;
  type: string;
  user?: {
    email: string;
  };
};

type AuthContextType = {
  initializing: boolean;
  session: Session | null;
  userId?: string;
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
    storage: AsyncStorage,
  },
});

const handleAuthCallbackUrl = async (url: string) => {
  const parsedUrl = Linking.parse(url);
  const errorDescription = parsedUrl.queryParams?.error_description;

  if (typeof errorDescription === "string") {
    throw new Error(errorDescription);
  }

  const code = parsedUrl.queryParams?.code;

  if (typeof code !== "string") {
    return;
  }

  await supabase.auth.exchangeCodeForSession(code);
};

export const signInWithEmail = (email: string) =>
  supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return { data, error };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "success") {
    await handleAuthCallbackUrl(result.url);
  }

  return { data, error };
};

export const signOut = () => supabase.auth.signOut({ scope: "local" });

export const updatePassword = ({ password }: { password: string }) =>
  supabase.auth.updateUser({ password });

export const deleteAccount = async () => {
  await supabase.rpc("delete_user");
  await supabase.auth.signOut();
};

const AuthContext = createContext<AuthContextType>({
  initializing: true,
  session: null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  const handleUrl = useCallback((url: string) => {
    void handleAuthCallbackUrl(url);
  }, []);

  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
      })
      .finally(() => {
        setInitializing(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleUrl]);

  return (
    <AuthContext.Provider
      value={{
        initializing,
        session,
        userId: session?.user.id,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
