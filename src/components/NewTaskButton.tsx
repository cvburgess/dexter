import { useRouter } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

import { useTheme } from "@/utils/theme";

/**
 * The "+ New Task" button rendered inside the tab bar's bottom accessory
 * (iOS 26+). Opens the create-task modal. The system moves the accessory
 * into the inline slot beside the minimized tab bar on scroll, so the
 * inline placement renders a more compact variant.
 */
export function NewTaskButton() {
  const router = useRouter();
  const theme = useTheme();
  const placement = NativeTabs.BottomAccessory.usePlacement();

  return (
    <TouchableOpacity
      accessibilityLabel="New Task"
      accessibilityRole="button"
      style={styles.button}
      onPress={() => router.push("/new-task")}
    >
      <Text
        style={[
          placement === "inline" ? styles.inlineLabel : styles.label,
          { color: theme.colors.primary },
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
