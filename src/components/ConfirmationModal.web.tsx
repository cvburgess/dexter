import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { SHADOW_LG, Theme, useTheme, withOpacity } from "@/utils/theme";

import {
  type ConfirmationActionRole,
  type ConfirmationModalProps,
  resolveActions,
} from "./ConfirmationModal.types";
import { WebOverlay } from "./WebOverlay.web";

/** Goes through `WebOverlay.web.tsx`, not RN's `Modal` — a Radix dismissable
 * layer's `pointer-events: none` on the body left these buttons dead. */
export function ConfirmationModal(props: ConfirmationModalProps) {
  const { visible, title, message, onClose } = props;
  const theme = useTheme();
  const actions = resolveActions(props);

  // `Modal` used to give Escape-to-dismiss for free; keep it. Guarded since
  // this file's unit test runs under RN, where `window` has no DOM events.
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
    <WebOverlay>
      {/*
        A plain div for the backdrop: `position: fixed` is web-only and outside
        React Native's style types (same approach as DateField.web's popover).
      */}
      <div style={backdropStyle(theme)} onClick={onClose}>
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
                backgroundColor: theme.colors.surfaceSunken,
                borderRadius: theme.radii.md,
                boxShadow: SHADOW_LG,
                padding: theme.space.md,
              },
            ]}
          >
            <Text
              style={[
                theme.fonts.title,
                { color: theme.colors.text, marginBottom: theme.space.sm },
              ]}
            >
              {title}
            </Text>
            <Text
              style={[
                theme.fonts.body,
                {
                  color: theme.colors.textSecondary,
                  marginBottom: theme.space.md,
                },
              ]}
            >
              {message}
            </Text>
            <View style={[styles.buttons, { marginTop: theme.space.sm }]}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={`${action.label}-${index}`}
                  style={[
                    {
                      paddingVertical: theme.space.sm,
                      paddingHorizontal: theme.space.xs,
                    },
                    index < actions.length - 1
                      ? { marginRight: theme.space.md }
                      : null,
                  ]}
                  onPress={() => {
                    void action.onPress?.();
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      theme.fonts.control,
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
    </WebOverlay>
  );
}

// Dims with the app's own background, not black — black disappears over a
// dark surface (DEX-61).
const backdropStyle = (theme: Theme) =>
  ({
    position: "fixed",
    inset: 0,
    // No `zIndex`: `WebOverlay` owns the stacking order for every overlay.
    backgroundColor: withOpacity(theme.colors.background, 0.85),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.space.lg,
  }) as const;

const CARD_WRAPPER_STYLE = { width: "100%", maxWidth: 400 } as const;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    elevation: 5,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
});
