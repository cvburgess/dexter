import { Href, useRouter } from "expo-router";
import { useCallback } from "react";

// `fallback` covers a cold deep link with nothing to pop. `canDismiss`, not
// `canGoBack` — also true for a tab-jump "back" (DEX-93).
export const useDismissModal = (fallback: Href) => {
  const router = useRouter();

  return useCallback(() => {
    if (router.canDismiss()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
};
