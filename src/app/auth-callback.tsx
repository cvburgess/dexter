import { Redirect } from "expo-router";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";

/**
 * Landing route for auth redirects. On web the browser actually navigates to
 * /auth-callback?code=... after a magic link or Google OAuth, so a real route
 * must exist. AuthProvider picks the URL up via Linking.getInitialURL and
 * exchanges the code; this screen waits for the session to land. If there is
 * no session (yet), it falls back to the login screen, which redirects into
 * the app the moment the exchange completes.
 */
export default function AuthCallback() {
  const { initializing, session } = useAuth();

  if (initializing) {
    return <LoadingScreen />;
  }

  if (session) {
    return <Redirect href="/(app)/(tabs)/today" />;
  }

  return <Redirect href="/(auth)/login" />;
}
