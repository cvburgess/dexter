import { Href } from "expo-router";

import { LoadingScreen } from "@/components/LoadingScreen";
import { ModalScreen } from "@/components/ModalScreen";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useDismissModal } from "@/hooks/useDismissModal";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";

type TModalLoadingScreenProps = {
  /** Where ✕ lands when there is nothing beneath this screen to pop back to. */
  fallback: Href;
};

// Module scope so the header's save handler keeps one identity across renders —
// `useModalHeaderActions` re-wires on every render by design.
const noop = () => {};

/** What a modal renders while its query resolves — a bare `<LoadingScreen />`
 * would leave it with no ✕/✓, since that chrome lives in the unrendered form (DEX-101). */
export function ModalLoadingScreen({ fallback }: TModalLoadingScreenProps) {
  const dismiss = useDismissModal(fallback);

  // No `title`: the route's static one from `createModalScreenOptions` already
  // reads correctly, and the form sets its own once it has something to say.
  useModalHeaderActions({ canSave: false, onClose: dismiss, onSave: noop });

  return (
    <ModalScreen>
      <WebModalHeader isDisabled onClose={dismiss} onSave={noop} />
      <LoadingScreen />
    </ModalScreen>
  );
}
