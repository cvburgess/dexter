import { Href } from "expo-router";

import { Button } from "@/components/Button";
import { EmptyScreen } from "@/components/EmptyScreen";
import { ModalScreen } from "@/components/ModalScreen";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useDismissModal } from "@/hooks/useDismissModal";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";

type TModalErrorScreenProps = {
  /** Where ✕ lands when there is nothing beneath this screen to pop back to. */
  fallback: Href;
  /** What failed, in the user's terms. */
  message: string;
  onRetry: () => void;
};

/** Copy a modal shows for a failed query, phrased around the records it
 * couldn't load — one sentence, so a wording change is one edit. */
export const loadFailedMessage = (records: string) =>
  `Couldn't load your ${records}. Check your connection and try again.`;

// Module scope so the header's save handler keeps one identity across renders —
// `useModalHeaderActions` re-wires on every render by design.
const noop = () => {};

/** What a modal renders when its query failed, rather than treating the
 * empty result as a deleted record (DEX-100). ✓ is wired but disabled. */
export function ModalErrorScreen({
  fallback,
  message,
  onRetry,
}: TModalErrorScreenProps) {
  const dismiss = useDismissModal(fallback);

  useModalHeaderActions({ canSave: false, onClose: dismiss, onSave: noop });

  return (
    <ModalScreen>
      <WebModalHeader isDisabled onClose={dismiss} onSave={noop} />
      <EmptyScreen message={message}>
        <Button testID="modal-error-retry" onPress={onRetry}>
          Try again
        </Button>
      </EmptyScreen>
    </ModalScreen>
  );
}
