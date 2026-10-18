import { useRootNavigationState, useRouter } from "expo-router";
import { useIncomingShare } from "expo-sharing";
import { useEffect } from "react";

import { extractSharedUrl } from "@/utils/taskUrl";

// Sends a link shared into Dexter to the create-task modal, pre-filled
// (DEX-66). Renders nothing; the web build swaps in a no-op.
export function ShareIntentRedirect() {
  const router = useRouter();
  const { sharedPayloads, clearSharedPayloads, refreshSharePayloads } =
    useIncomingShare();
  const webUrl = sharedPayloads.find((p) => p.shareType === "url")?.value;
  const text = sharedPayloads.find((p) => p.shareType === "text")?.value;
  const hasShare = sharedPayloads.length > 0;
  // A cold-start payload can land before there's anything to navigate, and a
  // push then is dropped — waiting for the root nav state's `key` defers exactly that.
  const isNavigatorReady = useRootNavigationState()?.key !== undefined;

  useEffect(() => {
    if (!hasShare || !isNavigatorReady) return;

    const url = extractSharedUrl(webUrl, text);
    // Clearing only empties native storage; the refresh is what empties
    // `sharedPayloads`, so one share can't open two modals.
    clearSharedPayloads();
    refreshSharePayloads();
    // `push`, not `replace` — the modal opens *over* wherever the app was, and
    // ✕ has to land back there.
    router.push(url ? { pathname: "/new-task", params: { url } } : "/new-task");
  }, [
    hasShare,
    isNavigatorReady,
    webUrl,
    text,
    clearSharedPayloads,
    refreshSharePayloads,
    router,
  ]);

  return null;
}
