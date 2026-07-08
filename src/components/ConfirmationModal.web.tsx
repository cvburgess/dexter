import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "@/utils/theme";

import {
  type ConfirmationActionRole,
  type ConfirmationModalProps,
  resolveActions,
} from "./ConfirmationModal.types";

/**
 * Web confirmation prompt rendered as a themed modal, mirroring the look of the
 * app's other modals. Fully controlled via `visible`.
 */
export function ConfirmationModal(props: ConfirmationModalProps) {
  const { visible, title, message, onClose } = props;
  const theme = useTheme();
  const actions = resolveActions(props);

  const colorForRole = (role: ConfirmationActionRole | undefined) => {
    if (role === "destructive") return theme.colors.error;
    if (role === "cancel") return theme.colors.textSecondary;
    return theme.colors.primary;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.container,
            {
              backgroundColor: theme.colors.card,
              borderRadius: theme.borderRadius,
            },
          ]}
          onPress={() => {}}
        >
          <Text
            style={[
              styles.title,
              { color: theme.colors.text, marginBottom: theme.spacing / 2 },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.message,
              {
                color: theme.colors.textSecondary,
                marginBottom: theme.spacing,
              },
            ]}
          >
            {message}
          </Text>
          <View style={[styles.buttons, { marginTop: theme.spacing / 2 }]}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={`${action.label}-${index}`}
                style={[
                  styles.button,
                  index < actions.length - 1
                    ? { marginRight: theme.spacing }
                    : null,
                ]}
                onPress={() => {
                  void action.onPress?.();
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.buttonText,
                    {
                      color: colorForRole(action.role),
                      fontWeight: action.role === "cancel" ? "400" : "600",
                    },
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  container: {
    width: "100%",
    maxWidth: 400,
    padding: 20,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.25)",
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  message: {
    fontSize: 14,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  buttonText: {
    fontSize: 16,
  },
});
