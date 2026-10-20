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

import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { SHADOW_LG, useTheme } from "@/utils/theme";

import { WebOverlay } from "./WebOverlay.web";

// The custom navigator's screen options are the native stack's plus the flag
// expo-router's experimental web stack used to imply from `presentation`.
type Options = NativeStackNavigationOptions & { modal?: boolean };

type StackViewProps = ComponentProps<typeof NativeStackView>;

// `NativeStackView` on web only branches on `isPreloaded`; `emit`/`pop` are
// native-stack-only.
const noopEmit = (() => {}) as StackViewProps["emit"];
const noopPop = (() => {}) as StackViewProps["pop"];
const neverRemovalPrevented = (_key: string) => false;

/** True for routes that must render as centered dialogs — every `formSheet`/
 * `modal` presentation (the old bundle-wide experimental behavior). */
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
  const isLargeDevice = useIsLargeDevice();

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
      <View style={[styles.viewport, isLargeDevice && styles.viewportPadded]}>
        <Pressable
          accessibilityLabel="Dismiss modal"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        {/* A flex column, so `ModalScreen`'s `flex: 1` fills it. */}
        <View
          role="dialog"
          style={[
            styles.dialog,
            { backgroundColor: theme.colors.background },
            isLargeDevice && [
              styles.dialogCard,
              {
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                boxShadow: SHADOW_LG,
              },
            ],
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

  // SAFETY: same runtime shape; the types differ only in fields this consumer
  // never reads (expo-router's guide ships this exact cast).
  const nativeStackDescriptors =
    descriptors as unknown as NativeStackDescriptorMap;

  // The base stack keeps the screen beneath mounted (scroll survives); routes
  // past its index are preloaded and render hidden.
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
const MODAL_MAX_HEIGHT = 800;

// `WebOverlay`'s root is a plain fixed div, so the viewport fills by absolute
// positioning (no flex container to stretch in) and owns the dimmed backdrop.
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
  },
  viewportPadded: {
    padding: 24,
  },
  // Full-bleed on small screens; a capped, centered card on large ones.
  dialog: {
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    width: "100%",
  },
  dialogCard: {
    maxHeight: MODAL_MAX_HEIGHT,
    maxWidth: MODAL_MAX_WIDTH,
  },
});

export const WebModalStack = createStandardRouterNavigator(
  ModalStackContent,
  StackRouter,
);
