import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

import { useTheme } from "@/utils/theme";

/**
 * The "+ New Task" button rendered inside the tab bar's bottom accessory
 * (iOS 26+). Opens the create-task modal.
 */
export function NewTaskButton() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <TouchableOpacity
      accessibilityLabel="New Task"
      accessibilityRole="button"
      style={styles.button}
      onPress={() => router.push("/new-task")}
    >
      <Text style={[styles.label, { color: theme.colors.primary }]}>
        ＋ New Task
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
