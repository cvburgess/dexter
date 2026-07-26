import { StyleSheet, View } from "react-native";

import type { TModalScreenProps } from "./ModalScreen";

/**
 * Web implementation: the column every modal screen's contents live in.
 *
 * Expo Router's experimental web modal stack (`EXPO_UNSTABLE_WEB_MODAL=1`, see
 * docs/frontend.md) drops the screen straight into its own `.modalBody`, which
 * is `display: flex; flex: 1` with **no `flex-direction`** — so it falls back to
 * the CSS default, `row`. A screen that returns a fragment therefore hands the
 * modal two row siblings: `WebModalHeader` (`width: "100%"`, `alignItems:
 * "center"`) takes the full width with its buttons centred down the middle, and
 * the body gets squeezed to nothing. The modal looks empty apart from a stray ✕
 * and ✓.
 *
 * One `flex: 1` column here fixes it: the header keeps its natural height at the
 * top and the `flex: 1` body below fills the rest, matching what the native
 * form sheet does.
 */
export function ModalScreen({ children }: TModalScreenProps) {
  return <View style={styles.column}>{children}</View>;
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
  },
});
