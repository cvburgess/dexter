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

// Centered empty state for the Today-tab surfaces; reserves `insets.bottom`
// itself since the host SafeAreaView omits the edge (tab bar owns it).
export function EmptyScreen({ message, children }: TEmptyScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          gap: theme.space.sm,
          padding: theme.space.lg,
          paddingBottom: theme.space.lg + insets.bottom,
        },
      ]}
    >
      <Text
        style={[
          styles.message,
          { ...theme.fonts.body, color: theme.colors.textSecondary },
        ]}
      >
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
    justifyContent: "center",
  },
  message: { textAlign: "center" },
});
