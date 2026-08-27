import { useRouter } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

import { newTaskRoute } from "@/utils/newTaskRoute";
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

  // Reads the day from a module store, not context — this renders in the
  // bottom accessory, outside the tree a context value would reach.
  const openNewTask = () => router.push(newTaskRoute());

  return (
    <TouchableOpacity
      accessibilityLabel="New Task"
      accessibilityRole="button"
      style={[
        styles.button,
        {
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radii.full,
        },
      ]}
      onPress={openNewTask}
    >
      <Text
        style={[
          // The inline slot beside a minimized tab bar has room for less.
          placement === "inline" ? theme.fonts.body : theme.fonts.control,
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
    flex: 1,
    justifyContent: "center",
  },
});
