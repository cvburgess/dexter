import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useTheme } from "@/utils/theme";

export function LoadingScreen() {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ActivityIndicator color={theme.colors.textSecondary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
