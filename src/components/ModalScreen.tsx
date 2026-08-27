import type { ReactNode } from "react";

/** Native passthrough — no wrapper view, so the scroll view stays the
 * screen's outermost element for iOS's inset behaviors to find it. */
export type TModalScreenProps = {
  children: ReactNode;
};

export function ModalScreen({ children }: TModalScreenProps) {
  return <>{children}</>;
}
