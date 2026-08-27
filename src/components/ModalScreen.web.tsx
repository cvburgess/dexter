import { StyleSheet, View } from "react-native";

import type { TModalScreenProps } from "./ModalScreen";

/** .modalBody is flex with no flex-direction (defaults to row) — a fragment
 * would squeeze to nothing; this flex:1 column fixes it (docs/frontend.md). */
export function ModalScreen({ children }: TModalScreenProps) {
  return <View style={styles.column}>{children}</View>;
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
  },
});
