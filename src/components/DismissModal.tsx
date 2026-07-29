import { Href } from "expo-router";
import { useEffect, useRef } from "react";

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
 */
export function DismissModal({ fallback }: TDismissModalProps) {
  const dismiss = useDismissModal(fallback);
  const hasDismissed = useRef(false);

  useEffect(() => {
    if (hasDismissed.current) return;
    hasDismissed.current = true;
    dismiss();
  }, [dismiss]);

  return <LoadingScreen />;
}
