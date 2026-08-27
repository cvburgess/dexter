import { Redirect } from "expo-router";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { usePendingOAuthConsent } from "@/hooks/usePendingOAuthConsent";

// Real route because the browser navigates here after a magic link/OAuth
// exchange; a pending OAuth consent redirect wins over the default Today.
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
