import type { ReactNode } from "react";

/**
 * Native implementation (passthrough). The Stack navigator hosts the screen
 * directly, and the scroll view has to stay the screen's outermost element for
 * iOS's `contentInsetAdjustmentBehavior`/`automaticallyAdjustKeyboardInsets` to
 * inset it under the floating form-sheet header — so this deliberately adds no
 * wrapper view. See `ModalScreen.web.tsx` for why web needs one.
 */
export type TModalScreenProps = {
  children: ReactNode;
};

export function ModalScreen({ children }: TModalScreenProps) {
  return <>{children}</>;
}
