import { router } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useEffect } from "react";

import { extractSharedUrl } from "@/utils/taskUrl";

/**
 * Sends a link shared into Dexter from another app to the create-task modal,
 * with the link pre-filled (DEX-66). Renders nothing; mounted once, under
 * `ShareIntentProvider`.
 *
 * The provider already owns every way a share can arrive — the deep link the
 * share extension redirects on, the native module's own events, and an
 * `AppState` refresh when the app returns to the foreground — and publishes
 * `hasShareIntent`, which turns true only once the payload has actually been
 * populated. Waiting on that rather than on "a share is pending" is what makes
 * this a single effect: there is no half-filled payload to guard against, and
 * no window in which two signals for one share could both fire.
 *
 * Inert on web, where `useShareIntent` disables itself.
 */
export function ShareIntentRedirect() {
  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();
  const { text, webUrl } = shareIntent;

  useEffect(() => {
    if (!hasShareIntent) return;

    const url = extractSharedUrl(webUrl, text);
    // Clearing the payload is what closes the loop: `hasShareIntent` goes
    // false on the next render, so one share can't open two modals.
    resetShareIntent();
    // `push`, not `replace` — the modal opens *over* wherever the app was, and
    // ✕ has to land back there.
    router.push(url ? { pathname: "/new-task", params: { url } } : "/new-task");
    // `resetShareIntent` is deliberately omitted: the provider rebuilds it on
    // every render, so depending on it would re-run this effect continuously
    // for as long as a share is pending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent, webUrl, text]);

  return null;
}
