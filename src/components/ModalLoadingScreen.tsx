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

/**
 * What a modal screen renders while the query behind it is still resolving.
 *
 * A bare `<LoadingScreen />` leaves the modal with no way out, because the ✕/✓
 * chrome lives in the form that hasn't rendered yet — and on web that is the
 * *only* header: expo-router's web modal stack renders the screen straight into
 * its drawer with no header slot at all (`ModalStackRouteDrawer` reads only the
 * sheet detents and `webModalStyle`), so `createModalScreenOptions.web`'s
 * `headerShown: false` documents that rather than causing it. Flipping the flag
 * would change nothing (DEX-101).
 *
 * Takes a `fallback` and owns its own dismissal, like the sibling
 * `ModalErrorScreen` and `DismissModal`. ✓ is wired but disabled — there is
 * nothing to save yet — so the header keeps its usual shape and ✕ stays live.
 */
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
