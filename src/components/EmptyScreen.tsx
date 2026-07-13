import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/utils/theme";

type TEmptyScreenProps = {
  /** Primary message, centered on the surface. */
  message: string;
  /** Optional actions (e.g. buttons) rendered below the message. */
  children?: ReactNode;
};

// Centered empty/get-started state for the Today-tab surfaces (Tasks, Notes,
// Journal, Calendar). The host SafeAreaView omits the bottom edge (the native
// tab bar owns it), so reserve `insets.bottom` here — otherwise content centers
// over the area behind the tab bar and sits visibly low.
export function EmptyScreen({ message, children }: TEmptyScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: 24 + insets.bottom }]}>
      <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
        {message}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  message: { fontSize: 15, textAlign: "center" },
});
