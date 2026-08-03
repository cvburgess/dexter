import { router } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useEffect } from "react";

import { LoadingScreen } from "@/components/LoadingScreen";
import { extractSharedUrl } from "@/utils/taskUrl";

/**
 * Where a link shared into Dexter lands (DEX-66). Reads the payload the share
 * extension left behind, then hands the link straight to the create-task modal
 * as a route param — nothing is shown here beyond the moment it takes.
 *
 * A stop on the way rather than a screen of its own: `ShareIntentLinkingConfig`
 * can tell that *a* share arrived, but the payload is populated asynchronously
 * by the native side, so something has to be mounted to wait for it.
 */
export default function ShareIntentScreen() {
  const { shareIntent, resetShareIntent } = useShareIntentContext();
  // Depended on individually below: expo-share-intent keeps one object and
  // mutates its fields when the payload lands, so an effect watching the object
  // itself never re-runs.
  const sharedText = shareIntent?.text;
  const sharedWebUrl = shareIntent?.webUrl;

  useEffect(() => {
    // expo-share-intent renders an empty payload first and fills it in on a
    // later render. Bailing out is what tells the two apart from a share that
    // genuinely carried no link — this is the empty *first* render, not a
    // verdict.
    if (!sharedText && !sharedWebUrl) return;

    const url = extractSharedUrl(sharedWebUrl, sharedText);
    resetShareIntent();
    // `replace`, not `push`: this screen is a redirect, and leaving it on the
    // stack would put it behind the modal for ✕ to land back on.
    router.replace(
      url ? { pathname: "/new-task", params: { url } } : "/new-task",
    );
  }, [sharedText, sharedWebUrl, resetShareIntent]);

  return <LoadingScreen />;
}
