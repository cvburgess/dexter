import { useEffect, useState } from "react";

import { consumePendingOAuthAuthorizationId } from "@/utils/oauthReturn";

type PendingOAuthConsent = {
  resolving: boolean;
  authorizationId: string | null;
};

// `null` = not resolved yet; a wrapper object = resolved (its authorizationId
// may itself be null when nothing was pending).
type Resolved = { authorizationId: string | null };

// Reads — and clears, once — the id stashed when signing in from OAuth
// consent; resolving avoids a render that reads as "nothing pending".
export function usePendingOAuthConsent(enabled: boolean): PendingOAuthConsent {
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Deliberate: a consumed id must not be reported to the next sign-in as
      // freshly resolved once the session goes away.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
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
