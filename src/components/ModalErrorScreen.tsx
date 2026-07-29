import { Button } from "@/components/Button";
import { EmptyScreen } from "@/components/EmptyScreen";
import { ModalScreen } from "@/components/ModalScreen";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";

type TModalErrorScreenProps = {
  /** What failed, in the user's terms. */
  message: string;
  onClose: () => void;
  onRetry: () => void;
};

/**
 * What a modal screen renders when the query behind it failed, rather than
 * treating the empty result as a deleted record and bouncing the user
 * elsewhere (DEX-100).
 *
 * ✓ is wired but disabled — there is nothing to save from here — so the header
 * keeps its usual shape and ✕ stays live; retrying is the body's own button.
 */
export function ModalErrorScreen({
  message,
  onClose,
  onRetry,
}: TModalErrorScreenProps) {
  useModalHeaderActions({ canSave: false, onClose, onSave: () => {} });

  return (
    <ModalScreen>
      <WebModalHeader isDisabled onClose={onClose} onSave={() => {}} />
      <EmptyScreen message={message}>
        <Button testID="modal-error-retry" onPress={onRetry}>
          Try again
        </Button>
      </EmptyScreen>
    </ModalScreen>
  );
}
