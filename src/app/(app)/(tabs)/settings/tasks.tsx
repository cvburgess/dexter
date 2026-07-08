import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/utils/theme";

// Placeholder — task settings are tracked separately.
export default function TasksScreen() {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
        Task settings are coming soon.
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
