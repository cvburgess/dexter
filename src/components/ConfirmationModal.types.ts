export type ConfirmationActionRole = "default" | "cancel" | "destructive";

export interface ConfirmationAction {
  label: string;
  onPress?: () => void | Promise<void>;
  role?: ConfirmationActionRole;
}

export interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  /** Called whenever the modal is dismissed (cancel, confirm, or backdrop). */
  onClose: () => void;
  /** Convenience handler for the primary confirm button. Ignored when `actions` is set. */
  onConfirm?: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the synthesized confirm button as destructive. Ignored when `actions` is set. */
  destructive?: boolean;
  /** Full control over the buttons. Overrides `onConfirm`/`destructive`/labels. */
  actions?: ConfirmationAction[];
}

/**
 * Builds the button list shared by every platform variant. When `actions` is
 * provided it wins; otherwise a Cancel + confirm pair is synthesized.
 */
export function resolveActions(
  props: ConfirmationModalProps,
): ConfirmationAction[] {
  if (props.actions) return props.actions;
  return [
    { label: props.cancelLabel ?? "Cancel", role: "cancel" },
    {
      label: props.confirmLabel ?? "OK",
      role: props.destructive ? "destructive" : "default",
      onPress: props.onConfirm,
    },
  ];
}
