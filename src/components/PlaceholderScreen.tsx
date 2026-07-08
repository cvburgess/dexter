import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/utils/theme";

// Centered "coming soon" message for routes that are scaffolded but not yet
// implemented (e.g. most Settings subviews, the Search tab).
export function PlaceholderScreen({ message }: { message: string }) {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  text: {
    fontSize: 14,
  },
});
