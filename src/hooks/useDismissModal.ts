import { Href, useRouter } from "expo-router";
import { useCallback } from "react";

/**
 * The close a modal screen should use: pops rather than navigating, so whatever
 * the modal was opened over stays put.
 *
 * The `fallback` covers the one case a pop can't — a cold deep link straight to
 * the modal's URL, which leaves the stack holding only that screen. An
 * unguarded `back()` there is an unhandled `GO_BACK`: ✕ looks dead, and ✓
 * writes the update without ever closing. `dismissTo` looks tidier but replaces
 * the current screen when it can't find the target, which collapses exactly the
 * history this is protecting.
 */
export const useDismissModal = (fallback: Href) => {
  const router = useRouter();

  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
};
