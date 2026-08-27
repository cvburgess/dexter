import { router, useRootNavigationState } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useEffect } from "react";

import { extractSharedUrl } from "@/utils/taskUrl";

// Sends a link shared into Dexter to the create-task modal, pre-filled
// (DEX-66). Renders nothing; inert on web, where useShareIntent disables itself.
export function ShareIntentRedirect() {
  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();
  const { text, webUrl } = shareIntent;
  // A cold-start payload can land before there's anything to navigate, and a
  // push then is dropped — waiting for the root nav state's `key` defers exactly that.
  const isNavigatorReady = useRootNavigationState()?.key !== undefined;

  useEffect(() => {
    if (!hasShareIntent || !isNavigatorReady) return;

    const url = extractSharedUrl(webUrl, text);
    // Clearing the payload is what closes the loop: `hasShareIntent` goes
    // false on the next render, so one share can't open two modals.
    resetShareIntent();
    // `push`, not `replace` — the modal opens *over* wherever the app was, and
    // ✕ has to land back there.
    router.push(url ? { pathname: "/new-task", params: { url } } : "/new-task");
    // resetShareIntent omitted — the provider rebuilds it every render, which
    // would re-run this effect continuously while a share is pending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent, isNavigatorReady, webUrl, text]);

  return null;
}
