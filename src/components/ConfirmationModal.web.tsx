import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { SHADOW_LG, Theme, useTheme, withOpacity } from "@/utils/theme";

import {
  type ConfirmationActionRole,
  type ConfirmationModalProps,
  resolveActions,
} from "./ConfirmationModal.types";
import { WebOverlay } from "./WebOverlay.web";

/**
 * Web confirmation prompt rendered as a themed overlay, mirroring the look of
 * the app's other modals. Fully controlled via `visible`.
 *
 * Rendered through `components/WebOverlay.web.tsx` rather than React Native's
 * `Modal`, whose body portal inherits the `pointer-events: none` a Radix
 * dismissable layer puts on the body — that is what left these buttons visible
 * but dead in the three settings editors. `WebOverlay` portals to the body too,
 * but declares `pointer-events: auto` on its root, so the prompt works whether
 * it is owned by a modal screen or by the page underneath an open drawer (a
 * `TaskCard` prompt with the small-screen Backlog drawer up).
 *
 * The prompt used to render in-tree for the same reason, which scoped its
 * `position: fixed` backdrop to `.modal`'s transformed box — a prompt opened
 * from a modal screen dimmed the modal alone. Now that it is portalled, the
 * backdrop always covers the viewport, which is the right scope for a prompt
 * that can be owned by either.
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

/**
 * Dims the page with the app's *own* background rather than a fixed black wash:
 * a black scrim all but disappears over a dark theme's surface, while the
 * background color always pushes the page back a step on either scheme
 * (DEX-61).
 */
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
