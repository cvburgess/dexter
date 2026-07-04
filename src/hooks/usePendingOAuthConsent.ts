import { useEffect, useState } from "react";

import { consumePendingOAuthAuthorizationId } from "@/utils/oauthReturn";

type PendingOAuthConsent = {
  resolving: boolean;
  authorizationId: string | null;
};

/**
 * Reads — and clears, once — the authorization id stashed when an
 * unauthenticated visitor was bounced from the OAuth consent screen to sign-in.
 *
 * Every post-login redirect point calls this so the user is returned to consent
 * instead of dropped on Today, regardless of which route the session lands on:
 * web sign-in returns through `auth-callback.tsx`, but native Google completes
 * the exchange in place on the login screen, where `(auth)/_layout.tsx` is the
 * one that redirects. `enabled` should be true only once the session exists;
 * the redirect points render a loading state while `resolving` is true.
 */
export function usePendingOAuthConsent(enabled: boolean): PendingOAuthConsent {
  const [state, setState] = useState<PendingOAuthConsent>({
    resolving: enabled,
    authorizationId: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ resolving: false, authorizationId: null });
      return;
    }

    let active = true;
    setState((prev) => ({ ...prev, resolving: true }));
    void consumePendingOAuthAuthorizationId().then((authorizationId) => {
      if (active) setState({ resolving: false, authorizationId });
    });

    return () => {
      active = false;
    };
  }, [enabled]);

  return state;
}
