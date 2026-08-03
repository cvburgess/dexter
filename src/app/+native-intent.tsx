/**
 * Deep links that arrive from the OS, before Expo Router tries to route them
 * (DEX-66).
 *
 * The iOS share extension re-opens the app at `dexter://dataUrl=<key>?nonce=…`
 * — a handoff to `expo-share-intent`'s native module, not a route. Left alone,
 * Router matches it against the tree, finds nothing, and renders the built-in
 * "Unmatched Route" screen; `ShareIntentRedirect` then pushes the create-task
 * modal *over* that screen, so closing the modal drops the user on it.
 *
 * Returning a falsy path tells Router not to navigate at all. The native module
 * is unaffected: it reads the same URL through `expo-linking`'s
 * `useLinkingURL`, which has its own subscription, so the payload still lands
 * and `ShareIntentRedirect` still opens the modal — now over wherever the app
 * already was (or over the home route, on a cold start).
 */
export function redirectSystemPath({
  path,
}: {
  path: string | null;
  initial: boolean;
}): string | null {
  try {
    if (path?.includes("dataUrl=")) return null;
    return path;
  } catch {
    // Throwing here can crash the app, and a link we can't classify is better
    // handed to the router unchanged.
    return path;
  }
}
