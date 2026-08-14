import { ConfirmationModal } from "@/components/ConfirmationModal";
import { FocusTimerDock } from "@/components/FocusTimerDock";
import { useConfirmation } from "@/hooks/useConfirmation";
import { usePublishFocusTimer } from "@/hooks/useFocusTimer";

/**
 * The focus timer's one app-level mount (DEX-49): it publishes the running
 * block to the module store every surface reads, owns the write that completes
 * a block when its time runs out, and hosts the single prompt that guards
 * stopping one.
 *
 * The prompt lives here rather than at each call site because stopping is
 * offered from three places, and two of them cannot host a modal: the tab-bar
 * accessory is rendered twice at once (it would ask twice), and `MoreMenu`
 * renders once per task card. One host, one modal, one place the wording lives.
 *
 * Rendered from `app/(app)/_layout.tsx`, inside the providers and outside any
 * single tab screen.
 */
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
