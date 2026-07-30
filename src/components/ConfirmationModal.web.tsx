import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Theme, useTheme, withOpacity } from "@/utils/theme";

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
              backgroundColor: theme.colors.card,
              borderRadius: theme.radii.md,
              // Derived from `text`, not a fixed black: a shadow tuned for a
              // light surface is invisible on a dark one (DEX-61).
              boxShadow: `0px 2px 8px ${withOpacity(theme.colors.text, 0.25)}`,
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
                    theme.fonts.title,
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
    zIndex: 9999,
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
