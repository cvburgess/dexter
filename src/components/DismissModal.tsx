import { Href, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useDismissModal } from "@/hooks/useDismissModal";

type TDismissModalProps = {
  /** Where to land when there is nothing beneath this screen to pop back to. */
  fallback: Href;
};

/**
 * Closes the modal it is rendered in. What a modal screen returns once its
 * record is known to be gone — a deleted task, a row that aged out of the
 * canonical cache — instead of `<Redirect />`, which navigates the whole app
 * and discards whatever was underneath (DEX-100).
 *
 * One-shot, like the `hasSaved` guard the forms use: a re-render must not fire
 * a second `back()` and pop a screen the user meant to keep. The spinner is
 * what paints for the frame between mount and the pop landing.
 *
 * **`useFocusEffect`, not `useEffect`:** `router.back()` acts on whichever
 * navigator is focused, which is not necessarily the one this screen sits in.
 * A modal screen stays mounted while its tab is in the background, so a plain
 * mount effect would fire on any later refetch that drops the record — a
 * template deleted on another device, landing on the next focus refetch — and
 * pop whatever screen the user is actually looking at somewhere else. Waiting
 * for focus also keeps a close that is already in flight from being doubled:
 * `handleClose` pops on a successful delete, and the invalidation's refetch can
 * resolve before this screen has finished unmounting.
 */
export function DismissModal({ fallback }: TDismissModalProps) {
  const dismiss = useDismissModal(fallback);
  const hasDismissed = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (hasDismissed.current) return;
      hasDismissed.current = true;
      dismiss();
    }, [dismiss]),
  );

  return <LoadingScreen />;
}
