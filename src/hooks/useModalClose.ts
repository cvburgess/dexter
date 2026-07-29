import { Href, useRouter } from "expo-router";

/**
 * The ✕ handler for a modal screen. Pops rather than navigating, so whatever
 * the modal was opened over stays put. The guard covers the one case a push
 * can't: a cold deep link straight to the modal's route, which leaves the stack
 * holding only this screen — and an unguarded `back()` there is an unhandled
 * `GO_BACK` that makes ✕ look dead and leaves ✓ writing without ever closing.
 *
 * @param fallback where to land when there is nothing to pop back to.
 */
export function useModalClose(fallback: Href): () => void {
  const router = useRouter();

  return () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };
}
