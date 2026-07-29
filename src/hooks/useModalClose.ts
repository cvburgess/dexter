import { Href, useRouter } from "expo-router";
import { useCallback } from "react";

/**
 * How a settings modal editor closes: pop when there is a screen to pop back
 * to, and fall back to its list when there isn't.
 *
 * Popping rather than navigating is what keeps the history under the editor
 * intact — `router.dismissTo(href)` *replaces* the current screen when it
 * can't find its target, which discards everything beneath it and once left
 * Tasks as the root of the settings tab (DEX-65).
 *
 * The guard is `canDismiss`, not `canGoBack`: `canGoBack` is global, so it is
 * also true when the only "back" available is the tab navigator jumping to
 * another tab — which would skip this fallback and throw the user out of
 * Settings entirely. `canDismiss` walks the active chain for a *stack* with
 * something to pop, which is what `back()` will actually do here.
 */
export function useModalClose(fallbackHref: Href): () => void {
  const router = useRouter();

  return useCallback(() => {
    if (router.canDismiss()) router.back();
    else router.replace(fallbackHref);
  }, [router, fallbackHref]);
}
