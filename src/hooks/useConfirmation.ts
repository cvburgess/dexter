import { useCallback, useRef, useState } from "react";

import type {
  ConfirmationAction,
  ConfirmationModalProps,
} from "@/components/ConfirmationModal";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Full button control. When set, `confirmLabel`/`cancelLabel`/`destructive` are ignored. */
  actions?: ConfirmationAction[];
}

interface ConfirmationState {
  visible: boolean;
  title: string;
  message: string;
  actions: ConfirmationAction[];
}

const INITIAL_STATE: ConfirmationState = {
  visible: false,
  title: "",
  message: "",
  actions: [],
};

/**
 * Adapts the declarative {@link ConfirmationModal} to a Promise-based API so
 * imperative, sequential flows can `await confirm(...)`.
 *
 * @returns `confirm` — opens the modal and resolves `true` when a non-cancel
 *   action is chosen, `false` on cancel/dismiss. Any `actions[].onPress` still
 *   fires, so multi-button flows can branch inside the handlers.
 * @returns `confirmationProps` — spread onto a single `<ConfirmationModal />`.
 */
export function useConfirmation() {
  const [state, setState] = useState<ConfirmationState>(INITIAL_STATE);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;

      const settle = (value: boolean, onPress?: () => void | Promise<void>) => {
        if (resolverRef.current) {
          resolverRef.current = null;
          resolve(value);
        }
        void onPress?.();
      };

      const actions: ConfirmationAction[] = options.actions
        ? options.actions.map((action) => ({
            label: action.label,
            role: action.role,
            onPress: () => settle(action.role !== "cancel", action.onPress),
          }))
        : [
            {
              label: options.cancelLabel ?? "Cancel",
              role: "cancel",
              onPress: () => settle(false),
            },
            {
              label: options.confirmLabel ?? "OK",
              role: options.destructive ? "destructive" : "default",
              onPress: () => settle(true),
            },
          ];

      setState({
        visible: true,
        title: options.title,
        message: options.message,
        actions,
      });
    });
  }, []);

  const confirmationProps: ConfirmationModalProps = {
    visible: state.visible,
    title: state.title,
    message: state.message,
    actions: state.actions,
    onClose: close,
  };

  return { confirm, confirmationProps };
}
