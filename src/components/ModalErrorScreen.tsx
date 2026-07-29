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

/**
 * The copy a modal shows for a query that failed, phrased around the records it
 * couldn't load — "tasks", "repeat schedules". One sentence for every such
 * screen, so a wording change is one edit rather than a hunt through the app.
 */
export const loadFailedMessage = (records: string) =>
  `Couldn't load your ${records}. Check your connection and try again.`;

// Module scope so the header's save handler keeps one identity across renders —
// `useModalHeaderActions` re-wires on every render by design.
const noop = () => {};

/**
 * What a modal screen renders when the query behind it failed, rather than
 * treating the empty result as a deleted record and bouncing the user
 * elsewhere (DEX-100).
 *
 * Takes a `fallback` and owns its own dismissal, like the sibling
 * `DismissModal` — so a screen adopting this pattern needs neither its own
 * `useDismissModal` call nor a wrapper component to bridge the two.
 *
 * ✓ is wired but disabled — there is nothing to save from here — so the header
 * keeps its usual shape and ✕ stays live; retrying is the body's own button.
 */
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
