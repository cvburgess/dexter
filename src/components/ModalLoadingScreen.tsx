import { Href } from "expo-router";

import { LoadingScreen } from "@/components/LoadingScreen";
import { ModalScreen } from "@/components/ModalScreen";
import { WebModalHeader } from "@/components/WebModalHeader";
import { useModalClose } from "@/hooks/useModalClose";
import { useModalHeaderActions } from "@/hooks/useModalHeaderActions";

const noop = () => {};

type TModalLoadingScreenProps = {
  /** Where ✕ lands when the modal was reached by a cold deep link. */
  closeFallback: Href;
};

/**
 * The waiting state for a modal screen whose form can't render until its row
 * resolves. A bare `<LoadingScreen />` would leave the modal with no way out,
 * because the ✕/✓ chrome lives in the form — and on web that is the *only*
 * header: expo-router's web modal stack renders the screen straight into its
 * drawer with no header slot at all (`ModalStackRouteDrawer` reads only the
 * sheet detents and `webModalStyle`), so `createModalScreenOptions.web`'s
 * `headerShown: false` documents that rather than causing it. Flipping the flag
 * would change nothing (DEX-101).
 *
 * Render this instead of `<LoadingScreen />` from any modal gate, so ✕ exists
 * in every branch. ✓ is present but disabled — there is nothing to save yet.
 */
export function ModalLoadingScreen({
  closeFallback,
}: TModalLoadingScreenProps) {
  const handleClose = useModalClose(closeFallback);

  // No `title`: the route's static one from `createModalScreenOptions` already
  // reads correctly, and the form sets its own once it has something to say.
  useModalHeaderActions({ canSave: false, onClose: handleClose, onSave: noop });

  return (
    <ModalScreen>
      <WebModalHeader isDisabled onClose={handleClose} onSave={noop} />
      <LoadingScreen />
    </ModalScreen>
  );
}
