import { useRouter } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/utils/theme";

/**
 * The "+ New Task" button rendered inside the tab bar's bottom accessory
 * (iOS 26+) as a primary-filled capsule. Opens the create-task modal. The
 * system moves the accessory into the inline slot beside the minimized tab
 * bar on scroll, where the capsule renders more compactly.
 */
export function NewTaskButton() {
  const router = useRouter();
  const theme = useTheme();
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const isInline = placement === "inline";

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityLabel="New Task"
        accessibilityRole="button"
        style={[
          styles.button,
          isInline ? styles.inlineButton : styles.regularButton,
          { backgroundColor: theme.colors.primary },
        ]}
        onPress={() => router.push("/new-task")}
      >
        <Text
          style={[
            isInline ? styles.inlineLabel : styles.label,
            { color: theme.colors.primaryContent },
          ]}
        >
          ＋ New Task
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
  },
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  inlineButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  inlineLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  regularButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
});
