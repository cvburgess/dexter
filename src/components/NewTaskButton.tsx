import { useRouter } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

import { useTheme } from "@/utils/theme";

/**
 * The "+ New Task" button rendered inside the tab bar's bottom accessory
 * (iOS 26+), filling it as a primary-colored capsule. Opens the create-task
 * modal. The system moves the accessory into the inline slot beside the
 * minimized tab bar on scroll, where the label renders more compactly.
 */
export function NewTaskButton() {
  const router = useRouter();
  const theme = useTheme();
  const placement = NativeTabs.BottomAccessory.usePlacement();

  return (
    <TouchableOpacity
      accessibilityLabel="New Task"
      accessibilityRole="button"
      style={[styles.button, { backgroundColor: theme.colors.primary }]}
      onPress={() => router.push("/new-task")}
    >
      <Text
        style={[
          placement === "inline" ? styles.inlineLabel : styles.label,
          { color: theme.colors.primaryContent },
        ]}
      >
        ＋ New Task
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 999,
    flex: 1,
    justifyContent: "center",
  },
  inlineLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
