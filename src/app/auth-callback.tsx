import { Redirect } from "expo-router";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { usePendingOAuthConsent } from "@/hooks/usePendingOAuthConsent";

/**
 * Landing route for auth redirects. On web the browser actually navigates to
 * /auth-callback?code=... after a magic link or Google OAuth, so a real route
 * must exist. AuthProvider picks the URL up via Linking.getInitialURL and
 * exchanges the code; this screen waits for the session to land. If there is
 * no session (yet), it falls back to the login screen, which redirects into
 * the app the moment the exchange completes.
 *
 * If the user was bounced here from the OAuth consent screen before signing
 * in, we return them to consent (preserving `authorization_id`) instead of
 * dropping them on Today.
 */
export default function AuthCallback() {
  const { initializing, session } = useAuth();
  const pending = usePendingOAuthConsent(!initializing && !!session);

  if (initializing) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (pending.resolving) {
    return <LoadingScreen />;
  }

  if (pending.authorizationId) {
    return (
      <Redirect
        href={{
          pathname: "/oauth/consent",
          params: { authorization_id: pending.authorizationId },
        }}
      />
    );
  }

  return <Redirect href="/(app)/(tabs)/today" />;
}
