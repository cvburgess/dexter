import { useEffect } from "react";
import { Alert } from "react-native";

import {
  type ConfirmationActionRole,
  type ConfirmationModalProps,
  resolveActions,
} from "./ConfirmationModal.types";

function alertStyle(
  role: ConfirmationActionRole | undefined,
): "default" | "cancel" | "destructive" {
  return role ?? "default";
}

/**
 * Native (iOS + Android) confirmation prompt backed by the imperative
 * `Alert.alert`, which supports any button count and presents reliably from
 * any context (header menus, profile rows, etc.). The declarative `visible`
 * prop is bridged via an effect that fires once per `visible` -> true
 * transition; `onClose` resets the parent's state on any button press or
 * dismissal.
 */
export function ConfirmationModal(props: ConfirmationModalProps) {
  const { visible, title, message, onClose } = props;
  const actions = resolveActions(props);

  useEffect(() => {
    if (!visible) return;
    Alert.alert(
      title,
      message,
      actions.map((action) => ({
        text: action.label,
        style: alertStyle(action.role),
        onPress: () => {
          void action.onPress?.();
          onClose();
        },
      })),
      { onDismiss: onClose },
    );
    // Fire once per visible -> true transition; values are captured at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return null;
}
