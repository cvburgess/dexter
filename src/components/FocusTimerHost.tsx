import { ConfirmationModal } from "@/components/ConfirmationModal";
import { FocusTimerDock } from "@/components/FocusTimerDock";
import { useConfirmation } from "@/hooks/useConfirmation";
import { usePublishFocusTimer } from "@/hooks/useFocusTimer";

/** One app-level mount (DEX-49) for the stop-confirmation — the accessory
 * renders twice and MoreMenu renders per card, so neither can own it. */
export function FocusTimerHost() {
  const { confirm, confirmationProps } = useConfirmation();

  usePublishFocusTimer(confirm);

  return (
    <>
      <FocusTimerDock />
      <ConfirmationModal {...confirmationProps} />
    </>
  );
}
