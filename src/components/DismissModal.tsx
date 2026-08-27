import { Href, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useDismissModal } from "@/hooks/useDismissModal";

type TDismissModalProps = {
  /** Where to land when there is nothing beneath this screen to pop back to. */
  fallback: Href;
};

/** Closes the modal, replacing `<Redirect />` (DEX-100). **`useFocusEffect`,
 * not `useEffect`** — a background-tab mount effect would pop the wrong screen. */
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
