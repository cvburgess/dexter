import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/utils/theme";

import {
  type ConfirmationActionRole,
  type ConfirmationModalProps,
  resolveActions,
} from "./ConfirmationModal.types";

/**
 * Web confirmation prompt rendered as a themed overlay, mirroring the look of
 * the app's other modals. Fully controlled via `visible`.
 *
 * Deliberately **not** React Native's `Modal`, which portals into
 * `document.body`. Expo Router's web modal stack renders a screen inside `vaul`
 * (a Radix dialog), and a modal Radix dialog sets `pointer-events: none` outside
 * its own content — so a body-portaled prompt opened from a modal screen
 * (the repeat-schedule, list, and habit editors) painted on top but could never
 * be clicked. Rendering in-tree keeps the prompt inside whatever subtree owns
 * the pointer events. `position: fixed` still covers the viewport, except under
 * a transformed ancestor like the drawer, where covering the drawer is right.
 */
export function ConfirmationModal(props: ConfirmationModalProps) {
  const { visible, title, message, onClose } = props;
  const theme = useTheme();
  const actions = resolveActions(props);

  // `Modal` used to give Escape-to-dismiss for free; keep it. Guarded because
  // this file is also imported directly by its unit test, which runs under the
  // React Native environment where `window` is a stub with no DOM events.
  useEffect(() => {
    if (!visible || typeof window?.addEventListener !== "function") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;

  const colorForRole = (role: ConfirmationActionRole | undefined) => {
    if (role === "destructive") return theme.colors.error;
    if (role === "cancel") return theme.colors.textSecondary;
    return theme.colors.primary;
  };

  return (
    // A plain div for the backdrop: `position: fixed` is web-only and outside
    // React Native's style types (same approach as DateField.web's popover).
    <div style={BACKDROP_STYLE} onClick={onClose}>
      <div
        style={CARD_WRAPPER_STYLE}
        // The card is inside the backdrop, so a click on it would otherwise
        // bubble up and dismiss the prompt.
        onClick={(event) => event.stopPropagation()}
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.colors.card,
              borderRadius: theme.borderRadius,
            },
          ]}
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
        </View>
      </div>
    </div>
  );
}

const BACKDROP_STYLE = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 40,
} as const;

const CARD_WRAPPER_STYLE = { width: "100%", maxWidth: 400 } as const;

const styles = StyleSheet.create({
  container: {
    width: "100%",
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
