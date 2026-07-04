import { Session } from "@supabase/supabase-js";
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
import { Platform } from "react-native";

import {
  clearSupabaseAuthStorage,
  isInvalidRefreshTokenError,
} from "@/utils/authStorage";
import { supabase } from "@/utils/supabase";

// Re-exported so existing `import { supabase } from "@/hooks/useAuth"` call
// sites keep working; the singleton itself now lives in @/utils/supabase.
export { supabase };

// Platform-adaptive callback: dexter://auth-callback on native, the web
// origin's /auth-callback route on web (see app/auth-callback.tsx).
const redirectTo = Linking.createURL("auth-callback");

type AuthContextType = {
  initializing: boolean;
  session: Session | null;
  userId?: string;
};

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
  // On web, let Supabase do a full-page redirect; the /auth-callback route
  // completes the exchange when the browser returns. On native, open an auth
  // session in the browser and exchange the code from the returned URL.
  const skipBrowserRedirect = Platform.OS !== "web";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect },
  });

  if (error || !data.url || !skipBrowserRedirect) {
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
    // Errors here (denied consent, expired link, missing PKCE verifier) leave
    // the user on the login screen; log instead of rejecting unhandled.
    handleAuthCallbackUrl(url).catch((error: unknown) => {
      console.warn("Auth callback failed", error);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const finishBootstrap = (nextSession: Session | null) => {
      if (!isMounted) return;
      setSession(nextSession);
      setInitializing(false);
    };

    const loadSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;

        finishBootstrap(session);
      } catch (error) {
        // A corrupted or revoked refresh token would otherwise fail every
        // bootstrap; clear it so the user can sign in again.
        if (isInvalidRefreshTokenError(error)) {
          await clearSupabaseAuthStorage().catch(() => {});
        }
        finishBootstrap(null);
      }
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
