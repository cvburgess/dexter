import {
  NativeStackView,
  StackRouter,
  createStandardRouterNavigator,
  type NativeStackDescriptorMap,
  type NativeStackNavigationOptions,
  type NativeStackViewState,
  type NavigatorContentProps,
} from "expo-router";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { SHADOW_LG, useTheme } from "@/utils/theme";

import { WebOverlay } from "./WebOverlay.web";

// The custom navigator's screen options are the native stack's plus the flag
// expo-router's experimental web stack used to imply from `presentation`.
type Options = NativeStackNavigationOptions & { modal?: boolean };

type StackViewProps = ComponentProps<typeof NativeStackView>;

// The navigator renders the stack up to the last non-modal route with
// `NativeStackView`, then layers each modal route on top in a `WebOverlay`.
// Runtime only branches on `isPreloaded` — `emit`/`pop` are no-ops here (their
// events are native-stack-only, and the guide's own example passes neither).
const noopEmit = (() => {}) as StackViewProps["emit"];
const noopPop = (() => {}) as StackViewProps["pop"];
const neverRemovalPrevented = (_key: string) => false;

/** True for the routes that must render as centered dialogs instead of stack
 * screens — matches the old bundle-wide experimental behavior, where every
 * `formSheet`/`modal` presentation became a dialog. */
export function isModalRoute(options: Options): boolean {
  return (
    options.modal === true ||
    options.presentation === "formSheet" ||
    options.presentation === "modal"
  );
}

/** The dialog chrome around a single modal route's screen. */
export function WebModalOverlay({
  children,
  onDismiss,
  topmost = true,
}: {
  children: ReactNode;
  onDismiss: () => void;
  /** Only the focused (top) dialog answers Esc — a stacked lower one must
   * keep its listener off so one press closes one dialog, not the whole pile. */
  topmost?: boolean;
}) {
  const theme = useTheme();

  // Esc closes the dialog like the backdrop does (the old stack did too).
  useEffect(() => {
    if (!topmost) return;
    if (typeof window?.addEventListener !== "function") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss, topmost]);

  return (
    <WebOverlay>
      <View style={styles.viewport}>
        <Pressable
          accessibilityLabel="Dismiss modal"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        {/* `.modalBody` was flex with no direction — keep the body a flex column
            so `ModalScreen`'s `flex: 1` fills it (docs/frontend.md). */}
        <View
          role="dialog"
          style={[
            styles.dialog,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              boxShadow: SHADOW_LG,
            },
          ]}
        >
          {children}
        </View>
      </View>
    </WebOverlay>
  );
}

function ModalStackContent({
  state,
  descriptors,
  actions,
}: NavigatorContentProps<Options>) {
  // Filter preloaded routes (beyond the focused one) out of the active set.
  const activeRoutes = state.routes.slice(0, state.index + 1);
  const lastNonModalRouteIndex = activeRoutes.findLastIndex(
    (route) => !isModalRoute(descriptors[route.key].options),
  );
  const hasModals = lastNonModalRouteIndex < state.index;

  // Standard navigation descriptors have the same runtime shape as the native
  // stack's, despite the narrower type (the guide's own cast).
  // SAFETY: `NavigatorDescriptor` and `NativeStackDescriptorMap` differ only in
  // optional/extra fields (`navigation`, `route`) that this consumer never reads;
  // expo-router's guide ships this exact cast for the same purpose.
  const nativeStackDescriptors =
    descriptors as unknown as NativeStackDescriptorMap;

  if (!hasModals) {
    return (
      // Routes after the focused one are preloaded: render them hidden.
      <NativeStackView
        state={state}
        descriptors={nativeStackDescriptors}
        emit={noopEmit}
        isPreloaded={(key) =>
          state.routes.findIndex((route) => route.key === key) > state.index
        }
        isRemovalPrevented={neverRemovalPrevented}
        pop={noopPop}
      />
    );
  }

  // The base stack keeps every route up to the last non-modal one, so the
  // screen underneath stays mounted (and keeps its scroll position) while a
  // dialog floats above it.
  const baseStackRoutes = activeRoutes.slice(0, lastNonModalRouteIndex + 1);
  const baseStackPreloadedRoutes = state.routes.slice(state.index + 1);
  const baseStackState = {
    ...state,
    index: lastNonModalRouteIndex,
    routes: [...baseStackRoutes, ...baseStackPreloadedRoutes],
  } as NativeStackViewState;
  const modalRoutes = activeRoutes.slice(lastNonModalRouteIndex + 1);

  return (
    <View style={styles.base}>
      <NativeStackView
        state={baseStackState}
        descriptors={nativeStackDescriptors}
        emit={noopEmit}
        isPreloaded={(key) =>
          baseStackState.routes.findIndex((route) => route.key === key) >
          baseStackState.index
        }
        isRemovalPrevented={neverRemovalPrevented}
        pop={noopPop}
      />
      {modalRoutes.map((route, index) => (
        <WebModalOverlay
          key={route.key}
          onDismiss={() => actions.back()}
          topmost={index === modalRoutes.length - 1}
        >
          {descriptors[route.key].render()}
        </WebModalOverlay>
      ))}
    </View>
  );
}

const MODAL_MAX_WIDTH = 680;

// `WebOverlay`'s root is a plain fixed-position div, so the viewport cannot
// rely on `flex: 1` (nothing there is a flex container) — it fills via
// absolute positioning inside the fixed root, and owns the same dim the old
// experimental `.modal` backdrop used to.
const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
  viewport: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    flex: 1,
    flexDirection: "column",
    maxWidth: MODAL_MAX_WIDTH,
    overflow: "hidden",
    width: "100%",
  },
});

export const WebModalStack = createStandardRouterNavigator(
  ModalStackContent,
  StackRouter,
);
