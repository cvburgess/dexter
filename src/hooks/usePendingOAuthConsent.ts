import { useEffect, useState } from "react";

import { consumePendingOAuthAuthorizationId } from "@/utils/oauthReturn";

type PendingOAuthConsent = {
  resolving: boolean;
  authorizationId: string | null;
};

// `null` = not resolved yet; a wrapper object = resolved (its authorizationId
// may itself be null when nothing was pending).
type Resolved = { authorizationId: string | null };

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
 *
 * `resolving` is derived during render (not stored in an effect-set state) so
 * that the very first render after `enabled` flips true reports `resolving:
 * true` — otherwise a caller would momentarily see "enabled, nothing pending"
 * and redirect to Today before the effect finished consuming the stashed id.
 */
export function usePendingOAuthConsent(enabled: boolean): PendingOAuthConsent {
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    if (!enabled) {
      setResolved(null);
      return;
    }

    let active = true;
    void consumePendingOAuthAuthorizationId().then((authorizationId) => {
      if (active) setResolved({ authorizationId });
    });

    return () => {
      active = false;
    };
  }, [enabled]);

  return {
    resolving: enabled && resolved === null,
    authorizationId: resolved?.authorizationId ?? null,
  };
}
