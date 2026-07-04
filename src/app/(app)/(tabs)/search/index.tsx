import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/utils/theme";

// Placeholder — implementing search is tracked separately.
export default function SearchScreen() {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
        Search is coming soon.
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
