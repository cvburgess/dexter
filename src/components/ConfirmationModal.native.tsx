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

/** Native prompt backed by imperative `Alert.alert`; the declarative `visible`
 * prop bridges via an effect firing once per false→true transition. */
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
